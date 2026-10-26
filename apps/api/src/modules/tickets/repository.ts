import type { Prisma } from '@prisma/client';
import { TicketListQuerySchema } from '@bookleaf/shared';
import type { z } from 'zod';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';

export const ticketInclude = {
  book: { select: { id: true, title: true } },
  author: { select: { id: true, user: { select: { id: true, name: true } } } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.TicketInclude;

const messageInclude = { sender: { select: { id: true, name: true } } } satisfies Prisma.TicketMessageInclude;

export type TicketListQuery = z.output<typeof TicketListQuerySchema>;

const NO_AUTHOR = '00000000-0000-0000-0000-000000000000';
const DAY_MS = 86_400_000;

/** The only place ticket visibility is decided: authors are always filtered to their own tickets. */
export function ownership(session: Session): Prisma.TicketWhereInput {
  return session.role === 'ADMIN' ? {} : { authorId: session.authorId ?? NO_AUTHOR };
}

function searchFilter(q: string | undefined): Prisma.TicketWhereInput {
  if (!q) return {};
  const num = /^(?:bl-?)?(\d{1,9})$/i.exec(q.trim());
  const bySubject: Prisma.TicketWhereInput = { subject: { contains: q, mode: 'insensitive' } };
  if (!num) return bySubject;
  const n = Number(num[1]);
  return { OR: [bySubject, { number: n > 1000 ? n - 1000 : n }] };
}

export function listFilter(session: Session, q: TicketListQuery): Prisma.TicketWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (q.from) createdAt.gte = new Date(`${q.from}T00:00:00Z`);
  if (q.to) createdAt.lt = new Date(new Date(`${q.to}T00:00:00Z`).getTime() + DAY_MS);
  const assignee = q.assignee === 'me' ? { assigneeId: session.userId } : q.assignee === 'unassigned' ? { assigneeId: null } : {};
  return {
    ...ownership(session),
    ...(q.status ? { status: q.status } : {}),
    ...(q.category ? { category: q.category } : {}),
    ...(q.priority ? { priority: q.priority } : {}),
    ...(q.from || q.to ? { createdAt } : {}),
    ...assignee,
    ...searchFilter(q.q),
  };
}

/**
 * Admin queue order: unresolved first, then most urgent priority, then nearest SLA deadline,
 * then oldest. Enum order in Postgres follows declaration order, which matches this ranking.
 */
export const URGENCY_ORDER: Prisma.TicketOrderByWithRelationInput[] = [
  { status: 'asc' },
  { priority: 'asc' },
  { slaDueAt: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];
export const RECENT_ORDER: Prisma.TicketOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

export async function findTicketOrThrow(db: Db, session: Session, id: string) {
  const ticket = await db.ticket.findFirst({ where: { id, ...ownership(session) }, include: ticketInclude });
  if (!ticket) throw new NotFoundError('Ticket');
  return ticket;
}

export function findMessages(db: Db, ticketId: string, includeNotes: boolean) {
  return db.ticketMessage.findMany({
    where: { ticketId, ...(includeNotes ? {} : { kind: { not: 'INTERNAL_NOTE' } }) },
    include: messageInclude,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}
