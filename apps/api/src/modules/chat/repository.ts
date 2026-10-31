import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import { TICKET_REF_SELECT } from '../tickets/ticket-ref.js';

const SESSION_INCLUDE = {
  messages: { orderBy: { createdAt: 'asc' as const } },
  ticket: { select: TICKET_REF_SELECT },
  ticketDraft: { include: { ticket: { select: TICKET_REF_SELECT } } },
};

/** A session the author owns. Another author's session is reported as "not found". */
export async function findOwnSession(db: Db, id: string, authorId: string) {
  const s = await db.chatSession.findFirst({ where: { id, authorId }, include: SESSION_INCLUDE });
  if (!s) throw new NotFoundError('Chat session');
  return s;
}

/** A session in this workspace; another workspace's session is reported as "not found". */
export async function findWorkspaceSession(db: Db, id: string, workspaceId: string) {
  const s = await db.chatSession.findFirst({
    where: { id, workspaceId },
    include: SESSION_INCLUDE,
  });
  if (!s) throw new NotFoundError('Chat session');
  return s;
}

export type SessionWithMessages = Awaited<ReturnType<typeof findOwnSession>>;

/**
 * Atomically takes one turn from the session's allowance. Returns false when the session is full,
 * so concurrent sends can never exceed the limit.
 */
export async function reserveTurn(db: Db, id: string, maxTurns: number): Promise<boolean> {
  const res = await db.chatSession.updateMany({
    where: { id, turnCount: { lt: maxTurns } },
    data: { turnCount: { increment: 1 } },
  });
  return res.count === 1;
}
