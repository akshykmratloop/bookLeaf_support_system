import {
  FACT_IDS,
  PAYOUT_ELIGIBILITY,
  ROYALTY_STATUSES,
  type Fact,
  type RoyaltyStatus,
} from '@bookleaf/shared';
import { z } from 'zod';

/**
 * The few facts the BookLeaf domain pack (triage rules, reply templates) reads by name.
 * Every other fact is passed to the AI as it is. Null means the host did not send it.
 */
export interface RoyaltySignals {
  bookStatus: RoyaltyStatus | null;
  payoutEligible: boolean | null;
  authorTotalPendingPaise: number | null;
}

const find = (facts: readonly Fact[], id: string) => facts.find((f) => f.id === id);

function codeOf<T extends string>(facts: readonly Fact[], id: string, codes: readonly [T, ...T[]]) {
  const parsed = z.enum(codes).safeParse(find(facts, id)?.value);
  return parsed.success ? parsed.data : null;
}

export function royaltySignals(facts: readonly Fact[], bookId: string | null): RoyaltySignals {
  const eligibility = codeOf(facts, FACT_IDS.payoutEligibility, PAYOUT_ELIGIBILITY);
  const total = find(facts, FACT_IDS.totalPending)?.value;
  return {
    bookStatus: bookId ? codeOf(facts, FACT_IDS.bookRoyaltyStatus(bookId), ROYALTY_STATUSES) : null,
    payoutEligible: eligibility === null ? null : eligibility === 'ELIGIBLE',
    authorTotalPendingPaise: typeof total === 'number' ? total : null,
  };
}

/** The book's current stage as the host words it (e.g. "Cover Design"), if sent. */
export const stageOf = (facts: readonly Fact[], bookId: string): string | null =>
  find(facts, FACT_IDS.bookStage(bookId))?.display ?? null;
