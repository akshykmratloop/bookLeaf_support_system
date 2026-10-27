import { formatInr, type Fact } from '@bookleaf/shared';
import { toIsoDate } from '../../platform/clock.js';
import { derived, dateFact, moneyFact, recordSource, textFact, unknownFact } from './evidence.js';
import { PAYOUT_THRESHOLD_PAISE } from './kb-constants.js';
import { addDays, daysBetween, payoutDeadlineFor } from './payout-calendar.js';
import type { AuthorRecord, BookRecord } from './types.js';

export type BookRoyaltyStatus =
  'NOTHING_PENDING' | 'BELOW_THRESHOLD' | 'POSSIBLY_OVERDUE' | 'SCHEDULED';

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

export function bookRoyaltyFacts(book: BookRecord): Fact[] {
  const id = `book.${book.externalId}`;
  const src = (field: string) => recordSource('books', book.externalId, field);
  return [
    moneyFact(
      `${id}.royalty_earned`,
      `${book.title}: royalty earned`,
      book.royaltyEarnedPaise,
      src('royalty_earned'),
    ),
    moneyFact(
      `${id}.royalty_paid`,
      `${book.title}: royalty paid`,
      book.royaltyPaidPaise,
      src('royalty_paid'),
    ),
    moneyFact(
      `${id}.royalty_pending`,
      `${book.title}: royalty pending`,
      book.royaltyPendingPaise,
      src('royalty_pending'),
    ),
    book.royaltyPerCopyPaise === null
      ? unknownFact(
          `${id}.royalty_per_copy`,
          `${book.title}: royalty per copy`,
          'Not set until the book is published',
        )
      : moneyFact(
          `${id}.royalty_per_copy`,
          `${book.title}: royalty per copy`,
          book.royaltyPerCopyPaise,
          src('author_royalty_per_copy'),
        ),
    book.lastPayoutDate === null
      ? textFact(
          `${id}.last_payout`,
          `${book.title}: last payout`,
          'No payout has been made yet',
          src('last_royalty_payout_date'),
          'STATUS',
        )
      : dateFact(
          `${id}.last_payout`,
          `${book.title}: last payout`,
          book.lastPayoutDate,
          src('last_royalty_payout_date'),
        ),
  ];
}

export function royaltyAssessmentFacts(a: RoyaltyAssessment, book: BookRecord | null): Fact[] {
  const facts: Fact[] = [
    moneyFact(
      'author.total_pending',
      'Total royalty pending across all books',
      a.authorTotalPendingPaise,
      derived("sum of royalty_pending over the author's books", ['books.*.royalty_pending']),
    ),
    textFact(
      'author.payout_eligibility',
      'Payout eligibility',
      a.payoutEligible
        ? `Eligible (total pending ${formatInr(a.authorTotalPendingPaise)} ≥ ₹1,000)`
        : `Not yet eligible (total pending ${formatInr(a.authorTotalPendingPaise)} < ₹1,000; rolls over)`,
      derived(
        'total pending ≥ ₹1,000 threshold',
        ['author.total_pending', 'kb.payout_threshold'],
        ["Threshold applies to the author's total across books"],
      ),
      'STATUS',
    ),
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
  if (book && a.bookStatus) {
    facts.push(
      textFact(
        `book.${book.externalId}.royalty_status`,
        `${book.title}: royalty status`,
        STATUS_TEXT[a.bookStatus],
        derived(
          'book royalty status rule',
          [
            `book.${book.externalId}.royalty_pending`,
            'author.payout_eligibility',
            `book.${book.externalId}.last_payout`,
          ],
          ['Earnings accrual dates are not in the data; "possibly overdue" needs a human check'],
        ),
        'STATUS',
      ),
    );
  }
  return facts;
}
