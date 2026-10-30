import { describe, expect, it } from 'vitest';
import { royaltyBadge } from './royaltyStatus';

describe('royaltyBadge', () => {
  it('says "All paid" only when royalties were earned and nothing is pending', () => {
    const paid = { royaltyStatus: 'NOTHING_PENDING', royaltyEarnedPaise: 50_000 } as const;
    expect(royaltyBadge(paid).label).toBe('All paid');
  });

  it('says "No royalties yet" for a book that has earned nothing (e.g. still in production)', () => {
    const unreleased = { royaltyStatus: 'NOTHING_PENDING', royaltyEarnedPaise: 0 } as const;
    expect(royaltyBadge(unreleased).label).toBe('No royalties yet');
  });

  it('keeps the payout statuses as they are', () => {
    const scheduled = { royaltyStatus: 'SCHEDULED', royaltyEarnedPaise: 0 } as const;
    expect(royaltyBadge(scheduled).label).toBe('In the next payout');
  });
});
