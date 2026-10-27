import type { Fact, HostCustomer } from '@bookleaf/shared';
import type { AuthorAccount } from './data/authors.js';
import { buildFactsPack } from './facts/index.js';

/**
 * What BookLeaf tells the support module about one author: account-level facts, and each
 * book with the facts that belong to it. A book's facts leave out the account facts it repeats.
 */
export function toCustomer(account: AuthorAccount, dataAsOf: Date): HostCustomer {
  const author = account.record;
  const accountFacts = buildFactsPack({ author, bookId: null, dataAsOf }).facts;
  const shared = new Set(accountFacts.map((f) => f.id));
  const bookFacts = (bookId: string): Fact[] =>
    buildFactsPack({ author, bookId, dataAsOf }).facts.filter((f) => !shared.has(f.id));
  return {
    id: author.externalId,
    name: author.name,
    email: account.email,
    items: author.books.map((b) => ({ id: b.externalId, title: b.title, facts: bookFacts(b.id) })),
    facts: accountFacts,
  };
}
