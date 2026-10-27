import type { Fact } from '@bookleaf/shared';
import { distributionFacts } from './distribution.js';
import { KB_FACTS } from './kb-constants.js';
import { bookProfileFacts, portfolioFacts, productionFacts } from './production.js';
import {
  assessRoyalty,
  bookRoyaltyFacts,
  royaltyAssessmentFacts,
  type RoyaltyAssessment,
} from './royalty.js';
import type { FactsInput } from './types.js';

export interface FactsPack {
  facts: Fact[];
  royalty: RoyaltyAssessment;
}

/**
 * The single source of business facts for every channel. Pure: same input, same output.
 * Only the author's own books are ever read (the caller passes the authenticated author).
 */
export function buildFactsPack(input: FactsInput): FactsPack {
  const { author, bookId, text, dataAsOf } = input;
  const book = bookId ? (author.books.find((b) => b.id === bookId) ?? null) : null;
  const royalty = assessRoyalty(author, book, dataAsOf);
  const facts: Fact[] = [];
  if (book) {
    facts.push(
      ...bookProfileFacts(book),
      ...bookRoyaltyFacts(book),
      ...productionFacts(book),
      ...distributionFacts(book, text),
    );
  } else {
    facts.push(...portfolioFacts(author.books));
  }
  facts.push(...royaltyAssessmentFacts(royalty, book), ...KB_FACTS);
  return { facts, royalty };
}

export type { AuthorRecord, BookRecord, FactsInput } from './types.js';
export type { RoyaltyAssessment, BookRoyaltyStatus } from './royalty.js';
