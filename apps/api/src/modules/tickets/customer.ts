import {
  CUSTOMER_TICKETS_SHOWN,
  type CustomerItem,
  type CustomerTicket,
  type HostCustomer,
  type TicketCustomer,
} from '@bookleaf/shared';
import { customerOrNull } from '../../host/facts.js';
import type { Db } from '../../platform/db.js';
import type { Session } from '../auth/session.js';
import { accountLines, itemLines, type FieldLabel } from './customer-lines.js';
import type { TicketDeps } from './deps.js';
import { findTicketOrThrow, ownership, RECENT_ORDER } from './repository.js';
import { labelOf, TICKET_LABEL_SELECT } from './ticket-ref.js';

type Ticket = Awaited<ReturnType<typeof findTicketOrThrow>>;
type LocalBook = { id: string; externalId: string; title: string };

/** The ticket's customer as stored on our side (always there, even while the product is down). */
const localAuthor = (db: Db, t: Ticket) =>
  db.author.findFirstOrThrow({
    where: { id: t.authorId, workspaceId: t.workspaceId },
    include: {
      user: { select: { name: true, email: true } },
      books: {
        select: { id: true, externalId: true, title: true },
        orderBy: { externalId: 'asc' },
      },
    },
  });

/** The workspace's customer data fields: they name and order what the panel shows. */
const fieldLabels = (db: Db, workspaceId: string): Promise<FieldLabel[]> =>
  db.customerField.findMany({
    where: { workspaceId },
    select: { key: true, label: true, position: true },
  });

const DEFAULT_ITEM_NOUN = 'item';

/** The workspace's own word for an item (Workspace Settings → brand). */
async function itemNounOf(db: Db, workspaceId: string): Promise<string> {
  const s = await db.workspaceSettings.findUnique({
    where: { workspaceId },
    select: { itemNoun: true },
  });
  return s?.itemNoun.trim() || DEFAULT_ITEM_NOUN;
}

/** This customer's other tickets, in this workspace only (the session's own scope). */
async function otherTickets(db: Db, session: Session, t: Ticket) {
  const where = { ...ownership(session), authorId: t.authorId, id: { not: t.id } };
  const [rows, total] = await Promise.all([
    db.ticket.findMany({
      where,
      select: { id: true, subject: true, status: true, createdAt: true, ...TICKET_LABEL_SELECT },
      orderBy: RECENT_ORDER,
      take: CUSTOMER_TICKETS_SHOWN,
    }),
    db.ticket.count({ where }),
  ]);
  const items: CustomerTicket[] = rows.map((r) => ({
    id: r.id,
    number: labelOf(r),
    subject: r.subject,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
  return { items, total };
}

function itemsOf(
  record: HostCustomer | null,
  books: LocalBook[],
  fields: FieldLabel[],
  ticketBookId: string | null,
): CustomerItem[] {
  const isTicketItem = (id: string | null) => id !== null && id === ticketBookId;
  if (!record) return books.map((b) => ({ ...b, isTicketItem: isTicketItem(b.id), lines: [] }));
  return record.items.map((item) => {
    const id = books.find((b) => b.externalId === item.id)?.id ?? null;
    const lines = itemLines(item.id, item.details, item.facts, fields);
    return { id, externalId: item.id, title: item.title, isTicketItem: isTicketItem(id), lines };
  });
}

/**
 * The staff Customer panel for one ticket (U-1). The customer record is read through the
 * HostRecords interface only; when the product is down the profile and tickets still show.
 */
export async function getTicketCustomer(
  deps: TicketDeps,
  session: Session,
  ticketId: string,
): Promise<TicketCustomer> {
  const ticket = await findTicketOrThrow(deps.db, session, ticketId);
  const author = await localAuthor(deps.db, ticket);
  const [record, fields, others, itemNoun] = await Promise.all([
    customerOrNull(deps.records, author.externalId, ticket.workspaceId),
    fieldLabels(deps.db, ticket.workspaceId),
    otherTickets(deps.db, session, ticket),
    itemNounOf(deps.db, ticket.workspaceId),
  ]);
  return {
    name: record?.name ?? author.user.name,
    email: record?.email ?? author.user.email,
    externalId: author.externalId,
    recordsAvailable: record !== null,
    itemNoun,
    account: record ? accountLines(record.details, record.facts, fields) : [],
    items: itemsOf(record, author.books, fields, ticket.bookId),
    otherTickets: others.items,
    otherTicketsTotal: others.total,
  };
}
