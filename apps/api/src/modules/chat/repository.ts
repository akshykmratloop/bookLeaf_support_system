import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';

const SESSION_INCLUDE = {
  messages: { orderBy: { createdAt: 'asc' as const } },
  ticket: { select: { id: true, number: true } },
  ticketDraft: { include: { ticket: { select: { id: true, number: true } } } },
};

/** A session the author owns. Another author's session is reported as "not found". */
export async function findOwnSession(db: Db, id: string, authorId: string) {
  const s = await db.chatSession.findFirst({ where: { id, authorId }, include: SESSION_INCLUDE });
  if (!s) throw new NotFoundError('Chat session');
  return s;
}

export async function findSessionById(db: Db, id: string) {
  const s = await db.chatSession.findUnique({ where: { id }, include: SESSION_INCLUDE });
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

export function authorMessagesSince(db: Db, authorId: string, since: Date): Promise<number> {
  return db.chatMessage.count({
    where: { role: 'AUTHOR', createdAt: { gte: since }, session: { authorId } },
  });
}
