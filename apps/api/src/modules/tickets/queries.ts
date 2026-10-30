import type { AdminTicket, AdminTicketListItem, AuthorTicketListItem } from '@bookleaf/shared';
import type { Session } from '../auth/session.js';
import { getAuthorTicket } from './create.js';
import type { TicketDeps } from './deps.js';
import { toAdminListItem, toAdminTicket, toAuthorListItem } from './mappers.js';
import { CONVERSATION_KINDS } from './requester-view.js';
import {
  findMessages,
  findTicketOrThrow,
  listFilter,
  RECENT_ORDER,
  ticketInclude,
  QUEUE_ORDER,
  type TicketListQuery,
} from './repository.js';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Cursor = id of the last row; Prisma resumes after it under the same ordering. */
function page<R extends { id: string }, T>(rows: R[], limit: number, map: (r: R) => T): Page<T> {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: slice.map(map),
    nextCursor: hasMore ? (slice[slice.length - 1]?.id ?? null) : null,
  };
}

const cursorArgs = (cursor: string | undefined): { cursor?: { id: string }; skip?: number } =>
  cursor ? { cursor: { id: cursor }, skip: 1 } : {};

export async function listAdminTickets(
  deps: TicketDeps,
  session: Session,
  q: TicketListQuery,
): Promise<Page<AdminTicketListItem>> {
  const rows = await deps.db.ticket.findMany({
    where: listFilter(session, q),
    include: ticketInclude,
    orderBy: QUEUE_ORDER[q.sort],
    take: q.limit + 1,
    ...cursorArgs(q.cursor),
  });
  return page(rows, q.limit, toAdminListItem);
}

export async function listAuthorTickets(
  deps: TicketDeps,
  session: Session,
  q: TicketListQuery,
): Promise<Page<AuthorTicketListItem>> {
  const rows = await deps.db.ticket.findMany({
    where: listFilter(session, q),
    include: {
      ...ticketInclude,
      _count: { select: { messages: { where: { kind: 'REPLY' } } } },
      // The last message of the conversation only, fetched with the page (no query per ticket).
      messages: {
        where: { kind: { in: CONVERSATION_KINDS } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { kind: true, body: true, createdAt: true },
      },
    },
    orderBy: RECENT_ORDER,
    take: q.limit + 1,
    ...cursorArgs(q.cursor),
  });
  return page(rows, q.limit, toAuthorListItem);
}

export async function getAdminTicket(
  deps: TicketDeps,
  session: Session,
  id: string,
): Promise<AdminTicket> {
  const t = await findTicketOrThrow(deps.db, session, id);
  const [messages, jobs] = await Promise.all([
    findMessages(deps.db, id, true),
    deps.db.aiJob.findMany({ where: { ticketId: id } }),
  ]);
  return toAdminTicket(t, messages, jobs);
}

export { getAuthorTicket };
