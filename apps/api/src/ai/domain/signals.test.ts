import type { Fact } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { royaltySignals, stageOf } from './signals.js';

const status = (id: string, value: string, display = value): Fact => ({
  id,
  label: id,
  type: 'STATUS',
  value,
  display,
  source: { kind: 'KB', section: 'test', rule: 'test' },
});
const money = (id: string, paise: number): Fact => ({
  ...status(id, ''),
  type: 'MONEY',
  value: paise,
});

describe('royaltySignals', () => {
  it('reads the coded facts the host sends', () => {
    const facts = [
      status('book.BK1.royalty_status', 'SCHEDULED'),
      status('author.payout_eligibility', 'ELIGIBLE'),
      money('author.total_pending', 357_000),
    ];
    expect(royaltySignals(facts, 'BK1')).toEqual({
      bookStatus: 'SCHEDULED',
      payoutEligible: true,
      authorTotalPendingPaise: 357_000,
    });
  });

  it('says "not sent" (null) for missing or unknown values instead of guessing', () => {
    const facts = [status('book.BK1.royalty_status', 'LATE-ISH')];
    expect(royaltySignals(facts, 'BK1')).toEqual({
      bookStatus: null,
      payoutEligible: null,
      authorTotalPendingPaise: null,
    });
    expect(royaltySignals(facts, null).bookStatus).toBeNull();
  });
});

describe('stageOf', () => {
  it("returns the host's wording for the book's stage", () => {
    expect(stageOf([status('book.BK1.stage', 'COVER_DESIGN', 'Cover Design')], 'BK1')).toBe(
      'Cover Design',
    );
    expect(stageOf([], 'BK1')).toBeNull();
  });
});
