import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import { TICKET_REF_SELECT } from '../tickets/ticket-ref.js';

const WITH_TICKET = { ticket: { select: TICKET_REF_SELECT } } as const;

export async function findOwnDraft(db: Db, id: string, authorId: string) {
  const d = await db.ticketDraft.findFirst({ where: { id, authorId }, include: WITH_TICKET });
  if (!d) throw new NotFoundError('Ticket draft');
  return d;
}

export type TicketDraftRow = Awaited<ReturnType<typeof findOwnDraft>>;

/** The draft belongs to the author's workspace (one indexed read, only when creating). */
const workspaceOf = async (db: Db, authorId: string) =>
  (await db.author.findUniqueOrThrow({ where: { id: authorId }, select: { workspaceId: true } }))
    .workspaceId;

/** The draft of one chat conversation, created on first use (unique per conversation). */
export async function upsertChatDraft(db: Db, authorId: string, chatSessionId: string) {
  return db.ticketDraft.upsert({
    where: { chatSessionId },
    create: { workspaceId: await workspaceOf(db, authorId), authorId, chatSessionId },
    update: {},
    include: WITH_TICKET,
  });
}

/** The draft of one call thread, created on first use (unique per thread). */
export async function upsertThreadDraft(db: Db, authorId: string, voiceThreadId: string) {
  return db.ticketDraft.upsert({
    where: { voiceThreadId },
    create: { workspaceId: await workspaceOf(db, authorId), authorId, voiceThreadId },
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
