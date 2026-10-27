import type { Fact } from '@bookleaf/shared';
import { buildFactsPack, type AuthorRecord } from '../facts/index.js';

/**
 * Every verified fact for one author: the account-level pack plus each book's pack, de-duplicated
 * by id (account facts repeat in every pack). Authors have a handful of books, so this stays small
 * and the chat needs one AI call instead of a tool-calling loop. Only this author's data is read.
 */
export function buildAuthorFacts(author: AuthorRecord, text: string, dataAsOf: Date): Fact[] {
  const packs = [
    buildFactsPack({ author, bookId: null, text, dataAsOf }),
    ...author.books.map((b) => buildFactsPack({ author, bookId: b.id, text, dataAsOf })),
  ];
  const byId = new Map<string, Fact>();
  for (const fact of packs.flatMap((p) => p.facts)) {
    if (!byId.has(fact.id)) byId.set(fact.id, fact);
  }
  return [...byId.values()];
}
