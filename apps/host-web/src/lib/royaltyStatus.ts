import type { RoyaltyStatus } from '@bookleaf/shared';

/** A book's royalty status in plain words, with a colour (the words carry the meaning). */
export const ROYALTY_STATUS: Record<RoyaltyStatus, { label: string; tone: string }> = {
  NOTHING_PENDING: { label: 'All paid', tone: 'bg-brand-soft text-brand' },
  SCHEDULED: { label: 'In the next payout', tone: 'bg-brand-soft text-brand' },
  BELOW_THRESHOLD: { label: 'Below the payout minimum', tone: 'bg-warn-soft text-warn' },
  POSSIBLY_OVERDUE: { label: 'No payout yet: checking', tone: 'bg-danger-soft text-danger' },
};
