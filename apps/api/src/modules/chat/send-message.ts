import { Prisma } from '@prisma/client';
import type { ChatReply } from '@bookleaf/shared';
import { ConflictError, UsageLimitError } from '../../platform/errors.js';
import { QueueFullError } from '../../platform/keyed-queue.js';
import { startOfUtcDay } from '../assistant/limits.js';
import { authorIdOf, type Session } from '../auth/session.js';
import { toTicketDraft } from '../ticket-drafts/mappers.js';
import { produceAnswer, type StoredAnswer } from './answer.js';
import { type ChatContext, type ChatDeps } from './deps.js';
import { applyDraftAction } from './draft-turn.js';
import { toChatMessage } from './mappers.js';
import { authorMessagesSince, findOwnSession, reserveTurn } from './repository.js';
import { loadChat } from './sessions.js';

/** The model sees the last few exchanges only, which bounds cost per turn. */
const HISTORY_MESSAGES = 12;

export interface ChatMessageInput {
  chatId: string;
  body: string;
}

async function enforceDailyLimit(deps: ChatDeps, authorId: string): Promise<void> {
  const perDay = deps.limits.chat.messagesPerDay;
  const used = await authorMessagesSince(deps.db, authorId, startOfUtcDay(deps.clock.now()));
  if (used >= perDay)
    throw new UsageLimitError(
      'CHAT_DAILY_LIMIT',
      `You've reached today's limit of ${perDay} chat messages. You can still raise a ticket.`,
    );
}

async function takeTurn(deps: ChatDeps, chatId: string): Promise<void> {
  const maxTurns = deps.limits.chat.maxTurnsPerSession;
  if (!(await reserveTurn(deps.db, chatId, maxTurns)))
    throw new ConflictError(
      'CHAT_TURN_LIMIT',
      `This conversation reached its ${maxTurns}-message limit. Start a new conversation.`,
    );
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
  await enforceDailyLimit(deps, authorId);
  await takeTurn(deps, chat.id);
  await deps.db.chatMessage.create({
    data: { sessionId: chat.id, role: 'AUTHOR', body: input.body, createdAt: deps.clock.now() },
  });
  const history = chat.messages
    .slice(-HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, body: m.body }));
  const draft = chat.ticketDraft ? toTicketDraft(chat.ticketDraft) : null;
  const a = await produceAnswer(deps, { authorId, message: input.body, history, draft });
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
  await ctx.assistant.requireChatEnabled();
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
