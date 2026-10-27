import {
  FACT_IDS,
  formatInr,
  type Fact,
  type FactSource,
  type RoyaltyStatus,
} from '@bookleaf/shared';
import {
  codeFact,
  derived,
  dateFact,
  moneyFact,
  recordSource,
  statusFact,
  unknownFact,
} from './evidence.js';
import { PAYOUT_THRESHOLD_PAISE } from './kb-constants.js';
import { addDays, daysBetween, payoutDeadlineFor, toIsoDate } from './payout-calendar.js';
import type { AuthorRecord, BookRecord } from './types.js';

export type BookRoyaltyStatus = RoyaltyStatus;

export interface RoyaltyAssessment {
  authorTotalPendingPaise: number;
  payoutEligible: boolean;
  nextCycleDeadline: string;
  bookStatus: BookRoyaltyStatus | null;
  /** Days since the first payout deadline that passed without a payout (possibly overdue only). */
  overdueDays: number | null;
}

/** A payout cycle typically recurs every ~91 days; a gap longer than a cycle + window is stale. */
const STALE_AFTER_DAYS = 91 + 45;

function overdueSince(book: BookRecord, asOf: Date): Date | null {
  if (book.royaltyPendingPaise <= 0) return null;
  if (book.lastPayoutDate === null) {
    if (book.publicationDate === null) return null;
    const firstDeadline = payoutDeadlineFor(new Date(`${book.publicationDate}T00:00:00Z`));
    return firstDeadline < asOf ? firstDeadline : null;
  }
  const staleFrom = addDays(new Date(`${book.lastPayoutDate}T00:00:00Z`), STALE_AFTER_DAYS);
  return staleFrom < asOf ? staleFrom : null;
}

export function assessRoyalty(
  author: AuthorRecord,
  book: BookRecord | null,
  asOf: Date,
): RoyaltyAssessment {
  const total = author.books.reduce((sum, b) => sum + b.royaltyPendingPaise, 0);
  const eligible = total >= PAYOUT_THRESHOLD_PAISE;
  const base = {
    authorTotalPendingPaise: total,
    payoutEligible: eligible,
    nextCycleDeadline: toIsoDate(payoutDeadlineFor(asOf)),
  };
  if (!book) return { ...base, bookStatus: null, overdueDays: null };
  if (book.royaltyPendingPaise === 0)
    return { ...base, bookStatus: 'NOTHING_PENDING', overdueDays: null };
  if (!eligible) return { ...base, bookStatus: 'BELOW_THRESHOLD', overdueDays: null };
  const since = overdueSince(book, asOf);
  if (since)
    return { ...base, bookStatus: 'POSSIBLY_OVERDUE', overdueDays: daysBetween(since, asOf) };
  return { ...base, bookStatus: 'SCHEDULED', overdueDays: null };
}

const STATUS_TEXT: Record<BookRoyaltyStatus, string> = {
  NOTHING_PENDING: 'Nothing pending on this book',
  BELOW_THRESHOLD: 'Below the ₹1,000 payout threshold — rolls over to the next quarter',
  POSSIBLY_OVERDUE: 'No payout recorded although a payout deadline has passed — needs verification',
  SCHEDULED: 'Pending amount is due in the next payout cycle',
};

type Source = (field: string) => FactSource;

function perCopyFact(book: BookRecord, id: string, src: Source): Fact {
  const label = `${book.title}: royalty per copy`;
  return book.royaltyPerCopyPaise === null
    ? unknownFact(`${id}.royalty_per_copy`, label, 'Not set until the book is published')
    : moneyFact(
        `${id}.royalty_per_copy`,
        label,
        book.royaltyPerCopyPaise,
        src('author_royalty_per_copy'),
      );
}

function lastPayoutFact(book: BookRecord, id: string, src: Source): Fact {
  const label = `${book.title}: last payout`;
  const source = src('last_royalty_payout_date');
  return book.lastPayoutDate === null
    ? statusFact(`${id}.last_payout`, label, 'No payout has been made yet', source)
    : dateFact(`${id}.last_payout`, label, book.lastPayoutDate, source);
}

export function bookRoyaltyFacts(book: BookRecord): Fact[] {
  const id = `book.${book.externalId}`;
  const src: Source = (field) => recordSource('books', book.externalId, field);
  const money = (key: string, what: string, paise: number, field: string) =>
    moneyFact(`${id}.${key}`, `${book.title}: ${what}`, paise, src(field));
  return [
    money('royalty_earned', 'royalty earned', book.royaltyEarnedPaise, 'royalty_earned'),
    money('royalty_paid', 'royalty paid', book.royaltyPaidPaise, 'royalty_paid'),
    money('royalty_pending', 'royalty pending', book.royaltyPendingPaise, 'royalty_pending'),
    perCopyFact(book, id, src),
    lastPayoutFact(book, id, src),
  ];
}

function eligibilityFact(a: RoyaltyAssessment): Fact {
  const total = formatInr(a.authorTotalPendingPaise);
  const status = a.payoutEligible
    ? { code: 'ELIGIBLE', text: `Eligible (total pending ${total} ≥ ₹1,000)` }
    : {
        code: 'NOT_ELIGIBLE',
        text: `Not yet eligible (total pending ${total} < ₹1,000; rolls over)`,
      };
  return codeFact(
    FACT_IDS.payoutEligibility,
    'Payout eligibility',
    status,
    derived(
      'total pending ≥ ₹1,000 threshold',
      ['author.total_pending', 'kb.payout_threshold'],
      ["Threshold applies to the author's total across books"],
    ),
  );
}

function bookStatusFact(status: BookRoyaltyStatus, book: BookRecord): Fact {
  const id = `book.${book.externalId}`;
  return codeFact(
    FACT_IDS.bookRoyaltyStatus(book.externalId),
    `${book.title}: royalty status`,
    { code: status, text: STATUS_TEXT[status] },
    derived(
      'book royalty status rule',
      [`${id}.royalty_pending`, 'author.payout_eligibility', `${id}.last_payout`],
      ['Earnings accrual dates are not in the data; "possibly overdue" needs a human check'],
    ),
  );
}

export function royaltyAssessmentFacts(a: RoyaltyAssessment, book: BookRecord | null): Fact[] {
  const facts: Fact[] = [
    moneyFact(
      'author.total_pending',
      'Total royalty pending across all books',
      a.authorTotalPendingPaise,
      derived("sum of royalty_pending over the author's books", ['books.*.royalty_pending']),
    ),
    eligibilityFact(a),
    dateFact(
      'payout.next_cycle_deadline',
      'Next payout cycle closes by',
      a.nextCycleDeadline,
      derived(
        'end of current quarter + 45 days',
        ['data_as_of', 'kb.payout_window'],
        ['Calculated as of the data snapshot date'],
      ),
    ),
    unknownFact(
      'author.bank_account_linked',
      'Bank account linked for payouts',
      "Bank details are not in BookLeaf's support data",
    ),
  ];
  if (book && a.bookStatus) facts.push(bookStatusFact(a.bookStatus, book));
  return facts;
}
