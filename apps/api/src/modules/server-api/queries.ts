import type { Prisma } from '@prisma/client';
import type { ServerTicket, ServerTicketDetail, ServerTicketQuery } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import { SERVER_TICKET_SELECT, toServerTicket } from '../webhooks/payload.js';

/** Newest change first, then by id, so the cursor is stable while tickets keep changing. */
export async function listServerTickets(
  db: Db,
  workspaceId: string,
  q: ServerTicketQuery,
): Promise<{ items: ServerTicket[]; nextCursor: string | null }> {
  const where: Prisma.TicketWhereInput = {
    workspaceId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.updatedSince ? { updatedAt: { gte: new Date(q.updatedSince) } } : {}),
  };
  const rows = await db.ticket.findMany({
    where,
    select: SERVER_TICKET_SELECT,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, q.limit);
  return {
    items: page.map(toServerTicket),
    nextCursor: rows.length > q.limit ? (page.at(-1)?.id ?? null) : null,
  };
}

/** One ticket and its conversation. Internal staff notes are never included. */
export async function getServerTicket(
  db: Db,
  workspaceId: string,
  id: string,
): Promise<ServerTicketDetail> {
  const t = await db.ticket.findFirst({
    where: { id, workspaceId },
    select: {
      ...SERVER_TICKET_SELECT,
      messages: {
        where: { kind: { in: ['AUTHOR', 'REPLY', 'SYSTEM'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, kind: true, body: true, createdAt: true },
      },
    },
  });
  if (!t) throw new NotFoundError('Ticket');
  const messages = t.messages.map((m) => ({
    id: m.id,
    kind: m.kind as 'AUTHOR' | 'REPLY' | 'SYSTEM',
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));
  return { ...toServerTicket(t), messages };
}
