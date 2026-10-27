import type { ConversationDetail } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import { toTicketDraft } from '../ticket-drafts/mappers.js';
import { linesOf, threadOf } from '../voice/thread.js';
import { after, NEWEST_FIRST, type Cursor } from './cursor.js';
import { ticketRef, titleOf, type Listed } from './summary.js';

const TICKET = { select: { id: true, number: true } } as const;
/** Every call of the given threads, oldest first, with what was said and any ticket. */
const callsOf = (db: Db, threadIds: string[]) =>
  db.voiceSession.findMany({
    where: { OR: [{ id: { in: threadIds } }, { threadId: { in: threadIds } }] },
    orderBy: { createdAt: 'asc' },
    select: { id: true, threadId: true, transcript: true, ticket: TICKET },
  });
type CallRow = Awaited<ReturnType<typeof callsOf>>[number];

/** The first call of a thread: the voice module saves it with threadId = its own id (older rows: null). */
const firstCall = (db: Db) => ({
  OR: [{ threadId: null }, { threadId: { equals: db.voiceSession.fields.id } }],
});

function summarise(calls: CallRow[], draft?: { status: string; subject: string }) {
  const lines = calls.flatMap((c) => linesOf(c.transcript));
  return {
    title: titleOf(draft?.subject, lines.find((l) => l.role === 'AUTHOR')?.text),
    messageCount: lines.length,
    ticket: ticketRef(calls.find((c) => c.ticket)?.ticket),
  };
}

/** Connected calls, one row per thread (a continued call joins its first call), newest first. */
export async function listCalls(db: Db, authorId: string, from: Cursor | null, take: number) {
  const roots = await db.voiceSession.findMany({
    // Calls started from a chat are listed inside that chat, not again on their own.
    where: {
      authorId,
      chatSessionId: null,
      startedAt: { not: null },
      AND: [firstCall(db), after(from)],
    },
    orderBy: NEWEST_FIRST,
    take,
    select: { id: true, createdAt: true },
  });
  const ids = roots.map((r) => r.id);
  const [calls, drafts] = await Promise.all([
    callsOf(db, ids),
    db.ticketDraft.findMany({ where: { voiceThreadId: { in: ids } } }),
  ]);
  return roots.map((root): Listed => {
    const draft = drafts.find((d) => d.voiceThreadId === root.id);
    const own = calls.filter((c) => threadOf(c) === root.id);
    const at = root.createdAt;
    return {
      at,
      id: root.id,
      summary: {
        kind: 'CALL',
        id: root.id,
        startedAt: at.toISOString(),
        draftStatus: draft?.status ?? null,
        ...summarise(own, draft),
      },
    };
  });
}

/** One call thread with every line in spoken order and the ticket draft it built. */
export async function getCall(db: Db, authorId: string, id: string): Promise<ConversationDetail> {
  const root = await db.voiceSession.findFirst({ where: { id, authorId, ...firstCall(db) } });
  if (!root) throw new NotFoundError('Conversation');
  const [calls, draft] = await Promise.all([
    callsOf(db, [id]),
    db.ticketDraft.findUnique({ where: { voiceThreadId: id }, include: { ticket: TICKET } }),
  ]);
  return {
    kind: 'CALL',
    id,
    startedAt: root.createdAt.toISOString(),
    lines: calls.flatMap((c) => linesOf(c.transcript)),
    draft: draft ? toTicketDraft(draft) : null,
    ticket: ticketRef(draft?.ticket ?? calls.find((c) => c.ticket)?.ticket),
  };
}
