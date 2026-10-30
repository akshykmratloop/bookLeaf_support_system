import type { Prisma } from '@prisma/client';
import { type TicketListQuerySchema, type TicketSort } from '@bookleaf/shared';
import type { z } from 'zod';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';

export const ticketInclude = {
  book: { select: { id: true, title: true } },
  author: { select: { id: true, user: { select: { id: true, name: true } } } },
  assignee: { select: { id: true, name: true } },
  workspace: { select: { ticketPrefix: true } },
  category: { select: { label: true, slaHours: true } },
} satisfies Prisma.TicketInclude;

const messageInclude = {
  sender: { select: { id: true, name: true } },
} satisfies Prisma.TicketMessageInclude;

export type TicketListQuery = z.output<typeof TicketListQuerySchema>;

const NO_AUTHOR = '00000000-0000-0000-0000-000000000000';
const DAY_MS = 86_400_000;

/**
 * The only place ticket visibility is decided: every query stays inside the session's workspace,
 * and authors are always filtered to their own tickets.
 */
export function ownership(session: Session): Prisma.TicketWhereInput {
  const workspaceId = session.workspaceId;
  return session.role === 'ADMIN'
    ? { workspaceId }
    : { workspaceId, authorId: session.authorId ?? NO_AUTHOR };
}

/** "BL-1001", "bl1001", "AC2-1001" or a bare "1001": a number in the signed-in workspace only. */
const TICKET_LABEL = /^(?:[a-z]{2,5}\d*-|[a-z]{2,5})?(\d{1,9})$/i;

function searchFilter(q: string | undefined): Prisma.TicketWhereInput {
  if (!q) return {};
  const num = TICKET_LABEL.exec(q.trim());
  const bySubject: Prisma.TicketWhereInput = { subject: { contains: q, mode: 'insensitive' } };
  if (!num) return bySubject;
  return { OR: [bySubject, { number: Number(num[1]) }] };
}

export function listFilter(session: Session, q: TicketListQuery): Prisma.TicketWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (q.from) createdAt.gte = new Date(`${q.from}T00:00:00Z`);
  if (q.to) createdAt.lt = new Date(new Date(`${q.to}T00:00:00Z`).getTime() + DAY_MS);
  const assignee =
    q.assignee === 'me'
      ? { assigneeId: session.userId }
      : q.assignee === 'unassigned'
        ? { assigneeId: null }
        : {};
  return {
    ...ownership(session),
    ...(q.status ? { status: q.status } : {}),
    ...(q.category ? { categoryKey: q.category } : {}),
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
export const RECENT_ORDER: Prisma.TicketOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];
const OLDEST_ORDER: Prisma.TicketOrderByWithRelationInput[] = [{ createdAt: 'asc' }, { id: 'asc' }];

/** The admin queue's order for each `sort` choice. */
export const QUEUE_ORDER: Record<TicketSort, Prisma.TicketOrderByWithRelationInput[]> = {
  urgency: URGENCY_ORDER,
  oldest: OLDEST_ORDER,
  newest: RECENT_ORDER,
};

export async function findTicketOrThrow(db: Db, session: Session, id: string) {
  const ticket = await db.ticket.findFirst({
    where: { id, ...ownership(session) },
    include: ticketInclude,
  });
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
