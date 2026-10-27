import { Prisma } from '@prisma/client';
import type {
  AuthorTicket,
  ChatReply,
  ChatSession,
  ChatTicketRequestSchema,
  ChatTranscript,
} from '@bookleaf/shared';
import type { z } from 'zod';
import { ConflictError, ForbiddenError, UsageLimitError } from '../../platform/errors.js';
import { keyedQueue, QueueFullError } from '../../platform/keyed-queue.js';
import type { AssistantLimits } from '../assistant/limits.js';
import { startOfUtcDay } from '../assistant/limits.js';
import type { AssistantService } from '../assistant/service.js';
import type { Session } from '../auth/session.js';
import { createTicket, getAuthorTicket } from '../tickets/create.js';
import type { TicketDeps } from '../tickets/deps.js';
import type { TicketDraftService } from '../ticket-drafts/service.js';
import { produceAnswer } from './answer.js';
import { applyDraftAction } from './draft-turn.js';
import { toTicketDraft } from '../ticket-drafts/mappers.js';
import { toChatMessage, toChatSession } from './mappers.js';
import { authorMessagesSince, findOwnSession, findSessionById, reserveTurn } from './repository.js';

interface Deps extends TicketDeps {
  assistant: AssistantService;
  drafts: TicketDraftService;
  limits: AssistantLimits;
}

/** The model sees the last few exchanges only, which bounds cost per turn. */
const HISTORY_MESSAGES = 12;
/** Messages of one conversation waiting to be answered (the browser sends them one by one). */
const MAX_WAITING_PER_CONVERSATION = 3;

function authorIdOf(session: Session): string {
  if (session.role !== 'AUTHOR' || !session.authorId)
    throw new ForbiddenError('Only authors can use the chat');
  return session.authorId;
}

export function createChatService(deps: Deps) {
  const { db, clock, assistant, limits } = deps;
  const maxTurns = limits.chat.maxTurnsPerSession;
  // One conversation is answered in order, so each answer sees the exchange before it.
  const inOrder = keyedQueue(MAX_WAITING_PER_CONVERSATION);

  async function enforceDailyLimit(authorId: string): Promise<void> {
    const used = await authorMessagesSince(db, authorId, startOfUtcDay(clock.now()));
    if (used >= limits.chat.messagesPerDay)
      throw new UsageLimitError(
        'CHAT_DAILY_LIMIT',
        `You've reached today's limit of ${limits.chat.messagesPerDay} chat messages. You can still raise a ticket.`,
      );
  }

  /** One turn, run inside the conversation's queue: reads history only after earlier turns. */
  async function answerTurn(session: Session, id: string, body: string): Promise<ChatReply> {
    const authorId = authorIdOf(session);
    const chat = await findOwnSession(db, id, authorId);
    await enforceDailyLimit(authorId);
    if (!(await reserveTurn(db, chat.id, maxTurns)))
      throw new ConflictError(
        'CHAT_TURN_LIMIT',
        `This conversation reached its ${maxTurns}-message limit. Start a new conversation.`,
      );
    await db.chatMessage.create({
      data: { sessionId: chat.id, role: 'AUTHOR', body, createdAt: clock.now() },
    });
    const history = chat.messages
      .slice(-HISTORY_MESSAGES)
      .map((m) => ({ role: m.role, body: m.body }));
    const draft = chat.ticketDraft ? toTicketDraft(chat.ticketDraft) : null;
    const a = await produceAnswer(deps, { authorId, message: body, history, draft });
    const applied = await applyDraftAction(deps.drafts, session, chat.id, a.draft);
    const reply = await db.chatMessage.create({
      data: {
        sessionId: chat.id,
        role: 'ASSISTANT',
        body: applied.bodyOverride ?? a.body,
        source: a.source,
        factsUsed: a.factsUsed,
        check: a.check ?? Prisma.JsonNull,
        proposal: Prisma.JsonNull,
        model: a.model,
        latencyMs: a.latencyMs,
        createdAt: clock.now(),
      },
    });
    return {
      session: toChatSession(await findOwnSession(db, id, authorId), maxTurns),
      reply: toChatMessage(reply),
    };
  }

  return {
    async current(session: Session): Promise<ChatSession | null> {
      await assistant.requireChatEnabled();
      const latest = await db.chatSession.findFirst({
        where: { authorId: authorIdOf(session) },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!latest) return null;
      return toChatSession(await findOwnSession(db, latest.id, authorIdOf(session)), maxTurns);
    },

    async start(session: Session): Promise<ChatSession> {
      await assistant.requireChatEnabled();
      const authorId = authorIdOf(session);
      const created = await db.chatSession.create({ data: { authorId, createdAt: clock.now() } });
      return toChatSession(await findOwnSession(db, created.id, authorId), maxTurns);
    },

    async get(session: Session, id: string): Promise<ChatSession> {
      await assistant.requireChatEnabled();
      return toChatSession(await findOwnSession(db, id, authorIdOf(session)), maxTurns);
    },

    /** Admin read of any transcript (linked from a chat ticket); works even if chat is off. */
    async transcript(id: string): Promise<ChatTranscript> {
      const s = await findSessionById(db, id);
      return {
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        messages: s.messages.map(toChatMessage),
      };
    },

    async send(session: Session, id: string, body: string): Promise<ChatReply> {
      await assistant.requireChatEnabled();
      try {
        return await inOrder(id, () => answerTurn(session, id, body));
      } catch (err) {
        if (!(err instanceof QueueFullError)) throw err;
        throw new UsageLimitError(
          'CHAT_BUSY',
          'Please wait for the answers to your last messages before sending more.',
        );
      }
    },

    /** One ticket per conversation, confirmed and edited by the author. */
    async raiseTicket(
      session: Session,
      id: string,
      input: z.output<typeof ChatTicketRequestSchema>,
      key: string | null,
    ): Promise<{ ticket: AuthorTicket; created: boolean }> {
      await assistant.requireChatEnabled();
      const chat = await findOwnSession(db, id, authorIdOf(session));
      if (chat.ticket)
        return { ticket: await getAuthorTicket(deps, session, chat.ticket.id), created: false };
      try {
        return await createTicket(deps, session, input, key, {
          source: 'CHAT',
          chatSessionId: chat.id,
        });
      } catch (err) {
        const raced = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        const existing = raced
          ? await db.ticket.findUnique({ where: { chatSessionId: chat.id } })
          : null;
        if (!existing) throw err;
        return { ticket: await getAuthorTicket(deps, session, existing.id), created: false };
      }
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
