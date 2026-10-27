import type { Fact } from '@bookleaf/shared';
import { recordSource, textFact } from './evidence.js';
import type { BookRecord } from './types.js';

/** Platforms BookLeaf distributes to (KB), with patterns that match how authors write them. */
const PLATFORMS: { name: string; pattern: RegExp }[] = [
  { name: 'Amazon India', pattern: /amazon\s*(\.in\b|india\b)/i },
  { name: 'Amazon US', pattern: /amazon\s*(\.com\b|us\b|usa\b|america)/i },
  { name: 'Amazon UK', pattern: /amazon\s*(\.co\.uk\b|uk\b|united kingdom)/i },
  { name: 'Flipkart', pattern: /flipkart/i },
  { name: 'BookLeaf Store', pattern: /bookleaf\s*(store|shop)/i },
];

export function detectPlatforms(text: string): string[] {
  const found = PLATFORMS.filter((p) => p.pattern.test(text)).map((p) => p.name);
  if (found.length === 0 && /amazon/i.test(text)) return ['Amazon (region not stated)'];
  return found;
}

/**
 * `available_on` is BookLeaf's distribution record, not live marketplace status, and may be
 * incomplete. Facts say what the record shows; they never claim a book is or isn't listed.
 */
export function distributionFacts(book: BookRecord, text: string): Fact[] {
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
  for (const platform of detectPlatforms(text)) {
    const inRecord = book.availableOn.some((p) => p.toLowerCase() === platform.toLowerCase());
    const key = platform.toLowerCase().replace(/[^a-z]+/g, '_');
    facts.push(
      textFact(
        `${id}.platform.${key}`,
        `${book.title} on ${platform}`,
        inRecord
          ? `${platform} is in BookLeaf's distribution record`
          : `${platform} is not in BookLeaf's distribution record (the record may be incomplete — confirm before stating)`,
        src,
        'STATUS',
      ),
    );
  }
  return facts;
}
