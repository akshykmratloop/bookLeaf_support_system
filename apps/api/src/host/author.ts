import type { Fact } from '@bookleaf/shared';
import type { Db } from '../platform/db.js';
import { allFacts, customerOrNull, RECORDS_UNAVAILABLE } from './facts.js';
import type { HostRecords } from './types.js';

export interface AuthorView {
  name: string;
  firstName: string;
  /** The author's items (books) by our reference id, for ticket drafts. */
  books: { id: string; title: string }[];
  /** Every fact the host sent, or one "records unavailable" fact while it is down. */
  facts: Fact[];
}

/** The signed-in author as the assistants see them. Only this author's own records are read. */
export async function loadAuthorView(
  deps: { db: Db; records: HostRecords },
  authorId: string,
): Promise<AuthorView> {
  const author = await deps.db.author.findUniqueOrThrow({
    where: { id: authorId },
    include: { user: true, books: { orderBy: { externalId: 'asc' } } },
  });
  const customer = await customerOrNull(deps.records, author.externalId);
  const name = customer?.name ?? author.user.name;
  return {
    name,
    firstName: name.split(' ')[0] ?? name,
    books: author.books.map((b) => ({ id: b.id, title: b.title })),
    facts: customer ? allFacts(customer) : [RECORDS_UNAVAILABLE],
  };
}
