import { BOOK_STAGES, STAGE_LABELS, type Fact, type FactSource } from '@bookleaf/shared';
import { formatDate, formatInr } from '@bookleaf/shared';
import {
  dateFact,
  countFact,
  recordSource,
  statusFact,
  textFact,
  unknownFact,
} from './evidence.js';
import type { BookRecord } from './types.js';

/** Stages where the KB says delays usually happen, and why. */
const DELAY_POINTS: Partial<Record<BookRecord['stage'], string>> = {
  COVER_DESIGN: 'Cover Design often waits on the author approving the cover',
  PROOFREADING: 'Proofreading can take several revision rounds',
};

type Source = (field: string) => FactSource;

const sourceOf =
  (book: BookRecord): Source =>
  (field) =>
    recordSource('books', book.externalId, field);

function publicationFact(book: BookRecord, id: string, src: Source): Fact {
  const label = `${book.title}: publication date`;
  return book.publicationDate === null
    ? unknownFact(`${id}.publication_date`, label, 'Not published yet')
    : dateFact(`${id}.publication_date`, label, book.publicationDate, src('publication_date'));
}

function mrpFact(book: BookRecord, id: string, src: Source): Fact {
  if (book.mrpPaise === null)
    return unknownFact(`${id}.mrp`, `${book.title}: MRP`, 'MRP is set at publication');
  return {
    id: `${id}.mrp`,
    label: `${book.title}: MRP`,
    type: 'MONEY',
    value: book.mrpPaise,
    display: formatInr(book.mrpPaise),
    source: src('mrp'),
  };
}

function printPartnerFact(book: BookRecord, id: string, src: Source): Fact {
  const label = `${book.title}: print partner`;
  return book.printPartner === null
    ? unknownFact(`${id}.print_partner`, label, 'Assigned at the printing stage')
    : textFact(`${id}.print_partner`, label, book.printPartner, src('print_partner'));
}

export function bookProfileFacts(book: BookRecord): Fact[] {
  const id = `book.${book.externalId}`;
  const src = sourceOf(book);
  return [
    textFact(`${id}.title`, 'Book title', book.title, src('title')),
    textFact(`${id}.isbn`, `${book.title}: ISBN`, book.isbn, src('isbn')),
    statusFact(
      `${id}.stage`,
      `${book.title}: current stage`,
      STAGE_LABELS[book.stage],
      src('status'),
    ),
    countFact(
      `${id}.copies_sold`,
      `${book.title}: copies sold`,
      book.copiesSold,
      src('total_copies_sold'),
    ),
    publicationFact(book, id, src),
    mrpFact(book, id, src),
    printPartnerFact(book, id, src),
  ];
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
