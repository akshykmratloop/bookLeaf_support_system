import type { Fact } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import { customerOrNull, factsFor, RECORDS_UNAVAILABLE } from '../../host/facts.js';
import type { HostRecords } from '../../host/types.js';

export interface ContextDeps {
  db: Db;
  records: HostRecords;
}

const findTicket = (db: Db, ticketId: string) =>
  db.ticket.findUnique({
    where: { id: ticketId },
    include: {
      author: { include: { user: true, books: { orderBy: { externalId: 'asc' } } } },
      book: true,
      messages: { where: { kind: { in: ['AUTHOR', 'REPLY'] } }, orderBy: { createdAt: 'asc' } },
    },
  });

/** The author's facts from the host, for the ticket's book (or the account when no book). */
/** Facts from the host, by the host's own ids for the customer and the item. */
async function ticketFacts(deps: ContextDeps, customerId: string, itemId: string | null) {
  const customer = await customerOrNull(deps.records, customerId);
  return customer ? factsFor(customer, itemId) : [RECORDS_UNAVAILABLE];
}

/** Everything an AI handler needs for one ticket, scoped to the ticket's author. */
export async function loadTicketContext(deps: ContextDeps, ticketId: string) {
  const ticket = await findTicket(deps.db, ticketId);
  if (!ticket) throw new NotFoundError('Ticket');
  const book = ticket.book
    ? { externalId: ticket.book.externalId, title: ticket.book.title }
    : null;
  const facts: Fact[] = await ticketFacts(deps, ticket.author.externalId, book?.externalId ?? null);
  const authorMessages = [
    ticket.description,
    ...ticket.messages.filter((m) => m.kind === 'AUTHOR').map((m) => m.body),
  ];
  const lastReply = [...ticket.messages].reverse().find((m) => m.kind === 'REPLY')?.body ?? null;
  return {
    ticket,
    authorName: ticket.author.user.name,
    book,
    bookTitles: ticket.author.books.map((b) => b.title),
    facts,
    authorMessages,
    lastReply,
  };
}

export type TicketContext = Awaited<ReturnType<typeof loadTicketContext>>;
