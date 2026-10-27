import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';

const WITH_TICKET = { ticket: { select: { id: true, number: true } } } as const;

export async function findOwnDraft(db: Db, id: string, authorId: string) {
  const d = await db.ticketDraft.findFirst({ where: { id, authorId }, include: WITH_TICKET });
  if (!d) throw new NotFoundError('Ticket draft');
  return d;
}

export type TicketDraftRow = Awaited<ReturnType<typeof findOwnDraft>>;

/** The draft of one chat conversation, created on first use (unique per conversation). */
export function upsertChatDraft(db: Db, authorId: string, chatSessionId: string) {
  return db.ticketDraft.upsert({
    where: { chatSessionId },
    create: { authorId, chatSessionId },
    update: {},
    include: WITH_TICKET,
  });
}

/** The draft of one call thread, created on first use (unique per thread). */
export function upsertThreadDraft(db: Db, authorId: string, voiceThreadId: string) {
  return db.ticketDraft.upsert({
    where: { voiceThreadId },
    create: { authorId, voiceThreadId },
    update: {},
    include: WITH_TICKET,
  });
}

/** The latest call of a thread: the one a ticket sent from the thread links to. */
export function latestCallOfThread(db: Db, threadId: string) {
  return db.voiceSession.findFirst({
    where: { OR: [{ id: threadId }, { threadId }] },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
}
