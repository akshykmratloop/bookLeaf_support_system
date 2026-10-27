/**
 * Fact ids the support module's domain pack reads by name (triage rules, reply templates,
 * quick answers). The host sends facts under these ids; any other facts are passed to the
 * assistant as they are. See docs/integration.md.
 */
export const FACT_IDS = {
  totalPending: 'author.total_pending',
  payoutEligibility: 'author.payout_eligibility',
  nextPayoutDeadline: 'payout.next_cycle_deadline',
  bookPending: (bookId: string) => `book.${bookId}.royalty_pending`,
  bookRoyaltyStatus: (bookId: string) => `book.${bookId}.royalty_status`,
  bookStage: (bookId: string) => `book.${bookId}.stage`,
  bookIsbn: (bookId: string) => `book.${bookId}.isbn`,
} as const;

/** Value of a `bookRoyaltyStatus` fact. */
export const ROYALTY_STATUSES = [
  'NOTHING_PENDING',
  'BELOW_THRESHOLD',
  'POSSIBLY_OVERDUE',
  'SCHEDULED',
] as const;
export type RoyaltyStatus = (typeof ROYALTY_STATUSES)[number];

/** Value of the `payoutEligibility` fact. */
export const PAYOUT_ELIGIBILITY = ['ELIGIBLE', 'NOT_ELIGIBLE'] as const;
export type PayoutEligibility = (typeof PAYOUT_ELIGIBILITY)[number];
