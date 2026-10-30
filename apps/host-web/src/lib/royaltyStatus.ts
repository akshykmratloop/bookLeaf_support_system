import type { RoyaltyStatus } from '@bookleaf/shared';

/** A book's royalty status in plain words, with a colour (the words carry the meaning). */
export const ROYALTY_STATUS: Record<RoyaltyStatus, { label: string; tone: string }> = {
  NOTHING_PENDING: { label: 'All paid', tone: 'bg-brand-soft text-brand' },
  SCHEDULED: { label: 'In the next payout', tone: 'bg-brand-soft text-brand' },
  BELOW_THRESHOLD: { label: 'Below the payout minimum', tone: 'bg-warn-soft text-warn' },
  POSSIBLY_OVERDUE: { label: 'No payout yet: checking', tone: 'bg-danger-soft text-danger' },
};

const NO_ROYALTIES_YET = { label: 'No royalties yet', tone: 'bg-panel-2 text-ink-2' };

/** The badge for a book: "All paid" is only said when something was earned and paid. */
export function royaltyBadge(book: { royaltyStatus: RoyaltyStatus; royaltyEarnedPaise: number }) {
  if (book.royaltyStatus === 'NOTHING_PENDING' && book.royaltyEarnedPaise === 0)
    return NO_ROYALTIES_YET;
  return ROYALTY_STATUS[book.royaltyStatus];
}
