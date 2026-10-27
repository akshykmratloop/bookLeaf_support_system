import type { Fact } from '@bookleaf/shared';
import { recordSource, statusFact, textFact } from './evidence.js';
import type { BookRecord } from './types.js';

/** Platforms BookLeaf distributes to (KB). */
const PLATFORMS = ['Amazon India', 'Amazon US', 'Amazon UK', 'Flipkart', 'BookLeaf Store'];

/**
 * `available_on` is BookLeaf's distribution record, not live marketplace status, and may be
 * incomplete. Facts say what the record shows; they never claim a book is or isn't listed.
 */
export function distributionFacts(book: BookRecord): Fact[] {
  const id = `book.${book.externalId}`;
  const src = recordSource('books', book.externalId, 'available_on');
  const record = book.availableOn.length
    ? book.availableOn.join(', ')
    : 'No platforms recorded yet';
  const facts: Fact[] = [
    textFact(
      `${id}.distribution_record`,
      `${book.title}: platforms in BookLeaf's distribution record`,
      record,
      src,
    ),
  ];
  for (const platform of PLATFORMS) {
    const inRecord = book.availableOn.some((p) => p.toLowerCase() === platform.toLowerCase());
    const key = platform.toLowerCase().replace(/[^a-z]+/g, '_');
    facts.push(
      statusFact(
        `${id}.platform.${key}`,
        `${book.title} on ${platform}`,
        inRecord
          ? `${platform} is in BookLeaf's distribution record`
          : `${platform} is not in BookLeaf's distribution record (the record may be incomplete — confirm before stating)`,
        src,
      ),
    );
  }
  return facts;
}
