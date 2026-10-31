import type {
  AdminTicket,
  AdminTicketListItem,
  AuthorTicketListItem,
  TicketSort,
} from '@bookleaf/shared';
import type { Session } from '../auth/session.js';
import { getAuthorTicket } from './create.js';
import type { TicketDeps } from './deps.js';
import { afterCursor, encodeListCursor, type CursorRow } from './list-cursor.js';
import { toAdminListItem, toAdminTicket, toAuthorListItem } from './mappers.js';
import { CONVERSATION_KINDS } from './requester-view.js';
import {
  findMessages,
  findTicketOrThrow,
  listFilter,
  ticketInclude,
  QUEUE_ORDER,
  type TicketListQuery,
} from './repository.js';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** The cursor is the last row's sort key under the list's own order (see list-cursor.ts). */
function page<R extends CursorRow, T>(
  rows: R[],
  limit: number,
  sort: TicketSort,
  map: (r: R) => T,
): Page<T> {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  return {
    items: slice.map(map),
    nextCursor: hasMore && last ? encodeListCursor(sort, last) : null,
  };
}

/** The list filter, then only rows after the cursor (AND: the filter may hold its own OR). */
const pageFilter = (session: Session, q: TicketListQuery, sort: TicketSort) => ({
  AND: [listFilter(session, q), afterCursor(q.cursor, sort)],
});

/** Authors always see their tickets newest first, whatever `sort` says. */
const AUTHOR_SORT: TicketSort = 'newest';

/** Older AI attempts are history; the ticket view shows the latest per kind from these. */
const AI_JOBS_SHOWN = 20;

export async function listAdminTickets(
  deps: TicketDeps,
  session: Session,
  q: TicketListQuery,
): Promise<Page<AdminTicketListItem>> {
  const rows = await deps.db.ticket.findMany({
    where: pageFilter(session, q, q.sort),
    include: ticketInclude,
    orderBy: QUEUE_ORDER[q.sort],
    take: q.limit + 1,
  });
  return page(rows, q.limit, q.sort, toAdminListItem);
}

export async function listAuthorTickets(
  deps: TicketDeps,
  session: Session,
  q: TicketListQuery,
): Promise<Page<AuthorTicketListItem>> {
  const rows = await deps.db.ticket.findMany({
    where: pageFilter(session, q, AUTHOR_SORT),
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
    orderBy: QUEUE_ORDER[AUTHOR_SORT],
    take: q.limit + 1,
  });
  return page(rows, q.limit, AUTHOR_SORT, toAuthorListItem);
}

export async function getAdminTicket(
  deps: TicketDeps,
  session: Session,
  id: string,
): Promise<AdminTicket> {
  const t = await findTicketOrThrow(deps.db, session, id);
  const [messages, jobs] = await Promise.all([
    findMessages(deps.db, id, true),
    deps.db.aiJob.findMany({
      where: { ticketId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: AI_JOBS_SHOWN,
    }),
  ]);
  return toAdminTicket(t, messages, jobs);
}

export { getAuthorTicket };
