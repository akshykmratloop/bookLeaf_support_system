import { Prisma } from '@prisma/client';
import type { ChatReply } from '@bookleaf/shared';
import { ConflictError, UsageLimitError } from '../../platform/errors.js';
import { QueueFullError } from '../../platform/shared-state/errors.js';
import { startOfUtcDay, type AssistantLimits } from '../assistant/limits.js';
import { authorIdOf, type Session } from '../auth/session.js';
import { toTicketDraft } from '../ticket-drafts/mappers.js';
import { produceAnswer, type StoredAnswer } from './answer.js';
import { type ChatContext, type ChatDeps } from './deps.js';
import { applyDraftAction } from './draft-turn.js';
import { turnLimitError } from './limit.js';
import { toChatMessage } from './mappers.js';
import { authorMessagesSince, findOwnSession, reserveTurn } from './repository.js';
import { loadChat } from './sessions.js';

/** The model sees the last few exchanges only, which bounds cost per turn. */
const HISTORY_MESSAGES = 12;

export interface ChatMessageInput {
  chatId: string;
  body: string;
}

type ChatLimits = AssistantLimits['chat'];

const MINUTE_MS = 60_000;

/** The workspace's per-minute and per-day message limits for this author. */
async function enforceRateLimits(deps: ChatDeps, authorId: string, limits: ChatLimits) {
  const now = deps.clock.now();
  const perDay = limits.messagesPerDay;
  const used = await authorMessagesSince(deps.db, authorId, startOfUtcDay(now));
  if (used >= perDay)
    throw new UsageLimitError(
      'CHAT_DAILY_LIMIT',
      `You've reached today's limit of ${perDay} chat messages. You can still raise a ticket.`,
    );
  const recent = await authorMessagesSince(deps.db, authorId, new Date(now.getTime() - MINUTE_MS));
  if (recent >= limits.messagesPerMinute)
    throw new UsageLimitError(
      'CHAT_RATE_LIMIT',
      'You are sending messages very quickly. Please wait a minute and try again.',
    );
}

/** While the chat's call is live, the author talks there: typed turns would bypass its limit. */
async function refuseDuringCall(deps: ChatDeps, chatId: string): Promise<void> {
  const live = await deps.db.voiceSession.count({
    where: { chatSessionId: chatId, status: 'ACTIVE' },
  });
  if (live > 0)
    throw new ConflictError(
      'VOICE_CALL_ACTIVE',
      'You are on a call in this conversation. Say it on the call, or end the call to type.',
    );
}

async function takeTurn(deps: ChatDeps, chatId: string, maxTurns: number): Promise<void> {
  if (!(await reserveTurn(deps.db, chatId, maxTurns))) throw turnLimitError(maxTurns);
}

function saveReply(deps: ChatDeps, chatId: string, a: StoredAnswer, body: string) {
  return deps.db.chatMessage.create({
    data: {
      sessionId: chatId,
      role: 'ASSISTANT',
      body,
      source: a.source,
      factsUsed: a.factsUsed,
      check: a.check ?? Prisma.JsonNull,
      proposal: Prisma.JsonNull,
      model: a.model,
      latencyMs: a.latencyMs,
      createdAt: deps.clock.now(),
    },
  });
}

/** One turn, run inside the conversation's queue: reads history only after earlier turns. */
async function answerTurn(deps: ChatDeps, session: Session, input: ChatMessageInput) {
  const authorId = authorIdOf(session);
  const chat = await findOwnSession(deps.db, input.chatId, authorId);
  await refuseDuringCall(deps, chat.id);
  const { limits } = await deps.assistant.config(session.workspaceId);
  await enforceRateLimits(deps, authorId, limits.chat);
  await takeTurn(deps, chat.id, limits.chat.maxTurnsPerSession);
  await deps.db.chatMessage.create({
    data: { sessionId: chat.id, role: 'AUTHOR', body: input.body, createdAt: deps.clock.now() },
  });
  const history = chat.messages
    .slice(-HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, body: m.body }));
  const draft = chat.ticketDraft ? toTicketDraft(chat.ticketDraft) : null;
  const a = await produceAnswer(deps, {
    workspaceId: session.workspaceId,
    authorId,
    message: input.body,
    history,
    draft,
  });
  const applied = await applyDraftAction(deps.drafts, session, {
    chatSessionId: chat.id,
    action: a.draft,
    seenVersion: draft?.version ?? 0,
  });
  const reply = await saveReply(deps, chat.id, a, applied.bodyOverride ?? a.body);
  return { session: await loadChat(deps, session, chat.id), reply: toChatMessage(reply) };
}

/** Answers one author message. Messages of one conversation are answered in order. */
export async function sendMessage(
  ctx: ChatContext,
  session: Session,
  input: ChatMessageInput,
): Promise<ChatReply> {
  await ctx.assistant.requireChatEnabled(session.workspaceId);
  try {
    return await ctx.inOrder(input.chatId, () => answerTurn(ctx, session, input));
  } catch (err) {
    if (!(err instanceof QueueFullError)) throw err;
    throw new UsageLimitError(
      'CHAT_BUSY',
      'Please wait for the answers to your last messages before sending more.',
    );
  }
}
