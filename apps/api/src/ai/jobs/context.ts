import type { Book } from '@prisma/client';
import { toIsoDate } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import type { BookRecord } from '../facts/index.js';

const isoOrNull = (d: Date | null) => (d ? toIsoDate(d) : null);

export function toBookRecord(b: Book): BookRecord {
  return {
    id: b.id,
    externalId: b.externalId,
    title: b.title,
    isbn: b.isbn,
    stage: b.stage,
    publicationDate: isoOrNull(b.publicationDate),
    mrpPaise: b.mrpPaise,
    royaltyPerCopyPaise: b.royaltyPerCopyPaise,
    copiesSold: b.copiesSold,
    royaltyEarnedPaise: b.royaltyEarnedPaise,
    royaltyPaidPaise: b.royaltyPaidPaise,
    royaltyPendingPaise: b.royaltyPendingPaise,
    lastPayoutDate: isoOrNull(b.lastPayoutDate),
    printPartner: b.printPartner,
    availableOn: b.availableOn,
  };
}

/** Everything an AI handler needs for one ticket, read in one query, scoped to the ticket's author. */
export async function loadTicketContext(db: Db, ticketId: string) {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: {
      author: { include: { user: true, books: { orderBy: { externalId: 'asc' } } } },
      messages: { where: { kind: { in: ['AUTHOR', 'REPLY'] } }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!ticket) throw new NotFoundError('Ticket');
  const books = ticket.author.books.map(toBookRecord);
  const author = {
    id: ticket.author.id,
    externalId: ticket.author.externalId,
    name: ticket.author.user.name,
    books,
  };
  const book = books.find((b) => b.id === ticket.bookId) ?? null;
  const authorMessages = [
    ticket.description,
    ...ticket.messages.filter((m) => m.kind === 'AUTHOR').map((m) => m.body),
  ];
  const lastReply = [...ticket.messages].reverse().find((m) => m.kind === 'REPLY')?.body ?? null;
  return { ticket, author, book, authorMessages, lastReply };
}

export type TicketContext = Awaited<ReturnType<typeof loadTicketContext>>;
