import { BOOK_STAGES, STAGE_LABELS, type Fact } from '@bookleaf/shared';
import { formatDate, formatInr } from '@bookleaf/shared';
import { dateFact, countFact, recordSource, textFact, unknownFact } from './evidence.js';
import type { BookRecord } from './types.js';

/** Stages where the KB says delays usually happen, and why. */
const DELAY_POINTS: Partial<Record<BookRecord['stage'], string>> = {
  COVER_DESIGN: 'Cover Design often waits on the author approving the cover',
  PROOFREADING: 'Proofreading can take several revision rounds',
};

export function bookProfileFacts(book: BookRecord): Fact[] {
  const id = `book.${book.externalId}`;
  const src = (field: string) => recordSource('books', book.externalId, field);
  const facts: Fact[] = [
    textFact(`${id}.title`, 'Book title', book.title, src('title')),
    textFact(`${id}.isbn`, `${book.title}: ISBN`, book.isbn, src('isbn')),
    textFact(
      `${id}.stage`,
      `${book.title}: current stage`,
      STAGE_LABELS[book.stage],
      src('status'),
      'STATUS',
    ),
    countFact(
      `${id}.copies_sold`,
      `${book.title}: copies sold`,
      book.copiesSold,
      src('total_copies_sold'),
    ),
    book.publicationDate === null
      ? unknownFact(
          `${id}.publication_date`,
          `${book.title}: publication date`,
          'Not published yet',
        )
      : dateFact(
          `${id}.publication_date`,
          `${book.title}: publication date`,
          book.publicationDate,
          src('publication_date'),
        ),
    book.mrpPaise === null
      ? unknownFact(`${id}.mrp`, `${book.title}: MRP`, 'MRP is set at publication')
      : {
          id: `${id}.mrp`,
          label: `${book.title}: MRP`,
          type: 'MONEY',
          value: book.mrpPaise,
          display: formatInr(book.mrpPaise),
          source: src('mrp'),
        },
    book.printPartner === null
      ? unknownFact(
          `${id}.print_partner`,
          `${book.title}: print partner`,
          'Assigned at the printing stage',
        )
      : textFact(
          `${id}.print_partner`,
          `${book.title}: print partner`,
          book.printPartner,
          src('print_partner'),
        ),
  ];
  return facts;
}

export function productionFacts(book: BookRecord): Fact[] {
  if (book.stage === 'PUBLISHED_LIVE') return [];
  const id = `book.${book.externalId}`;
  const index = BOOK_STAGES.indexOf(book.stage);
  const remaining = BOOK_STAGES.slice(index + 1)
    .map((s) => STAGE_LABELS[s])
    .join(' → ');
  const facts: Fact[] = [
    textFact(`${id}.remaining_stages`, `${book.title}: stages still to come`, remaining, {
      kind: 'KB',
      section: 'Production Stages',
      rule: 'Stage order',
    }),
    unknownFact(
      `${id}.stage_entered`,
      `${book.title}: date it entered the current stage`,
      "Stage dates are not in BookLeaf's support data",
    ),
  ];
  const delay = DELAY_POINTS[book.stage];
  if (delay) {
    facts.push(
      textFact(`${id}.delay_point`, `${book.title}: known delay point`, delay, {
        kind: 'KB',
        section: 'Production Stages',
        rule: 'Typical delays',
      }),
    );
  }
  return facts;
}

/** Short one-line summary per book, used when a ticket is not about a specific book. */
export function portfolioFacts(books: BookRecord[]): Fact[] {
  return books.map((b) =>
    textFact(
      `book.${b.externalId}.summary`,
      `Book: ${b.title}`,
      `${STAGE_LABELS[b.stage]}; pending ${formatInr(b.royaltyPendingPaise)}; last payout ${b.lastPayoutDate ? formatDate(b.lastPayoutDate) : 'none yet'}`,
      recordSource('books', b.externalId, 'summary'),
    ),
  );
}
