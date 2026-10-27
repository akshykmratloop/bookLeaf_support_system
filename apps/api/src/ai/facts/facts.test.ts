import { describe, expect, it } from 'vitest';
import { sampleAuthor } from '../../../test/fixtures/sample-authors.js';
import { buildFactsPack } from './index.js';
import { payoutDeadlineFor, quarterEnd } from './payout-calendar.js';

const AS_OF = new Date('2025-12-31T00:00:00Z');
const pack = (authorId: string, bookId: string | null, text = '') =>
  buildFactsPack({ author: sampleAuthor(authorId), bookId, text, dataAsOf: AS_OF });
const fact = (p: ReturnType<typeof pack>, id: string) => p.facts.find((f) => f.id === id);

describe('payout calendar', () => {
  it('computes quarter ends and the 45-day payout deadline', () => {
    expect(quarterEnd(new Date('2025-02-10T00:00:00Z')).toISOString().slice(0, 10)).toBe(
      '2025-03-31',
    );
    expect(payoutDeadlineFor(new Date('2025-12-31T00:00:00Z')).toISOString().slice(0, 10)).toBe(
      '2026-02-14',
    );
    expect(payoutDeadlineFor(new Date('2024-07-05T00:00:00Z')).toISOString().slice(0, 10)).toBe(
      '2024-11-14',
    );
  });
});

describe('royalty facts on the seed data', () => {
  it('Kavita (BK016 ₹850) is below the threshold and rolls over', () => {
    const p = pack('AUTH009', 'BK016');
    expect(p.royalty.bookStatus).toBe('BELOW_THRESHOLD');
    expect(p.royalty.authorTotalPendingPaise).toBe(85_000);
    expect(p.royalty.payoutEligible).toBe(false);
  });

  it.each([
    ['AUTH003', 'BK005'],
    ['AUTH006', 'BK010'],
    ['AUTH010', 'BK018'],
  ])('%s %s has no payout although a deadline passed', (author, book) => {
    const p = pack(author, book);
    expect(p.royalty.bookStatus).toBe('POSSIBLY_OVERDUE');
    expect(p.royalty.overdueDays).toBeGreaterThan(180);
  });

  it('Priya BK002 has nothing pending, but the author still has ₹3,570 pending on BK001', () => {
    const p = pack('AUTH001', 'BK002');
    expect(p.royalty.bookStatus).toBe('NOTHING_PENDING');
    expect(fact(p, 'author.total_pending')?.display).toBe('₹3,570');
  });

  it('Priya BK001 is scheduled for the next cycle closing 14 Feb 2026', () => {
    const p = pack('AUTH001', 'BK001');
    expect(p.royalty.bookStatus).toBe('SCHEDULED');
    expect(fact(p, 'payout.next_cycle_deadline')?.value).toBe('2026-02-14');
  });

  it('no published, regularly paid book is flagged overdue', () => {
    for (const [a, b] of [
      ['AUTH002', 'BK003'],
      ['AUTH004', 'BK006'],
      ['AUTH007', 'BK011'],
    ] as const) {
      expect(pack(a, b).royalty.bookStatus).toBe('SCHEDULED');
    }
  });
});

describe('unknowns and production', () => {
  it('in-production books report unknown MRP and publication date, never zero', () => {
    const p = pack('AUTH007', 'BK013');
    expect(fact(p, 'book.BK013.mrp')?.type).toBe('UNKNOWN');
    expect(fact(p, 'book.BK013.publication_date')?.type).toBe('UNKNOWN');
    expect(fact(p, 'book.BK013.stage')?.display).toBe('Cover Design');
    expect(fact(p, 'book.BK013.delay_point')?.display).toMatch(/approving the cover/);
  });

  it('bank details are always an unknown fact', () => {
    expect(fact(pack('AUTH001', null), 'author.bank_account_linked')?.type).toBe('UNKNOWN');
  });
});

describe('distribution facts', () => {
  it('a platform missing from the record is flagged for confirmation, not denied', () => {
    const p = pack('AUTH001', 'BK001', 'My book shows Currently Unavailable on Amazon US');
    const f = fact(p, 'book.BK001.platform.amazon_us');
    expect(f?.display).toMatch(/not in BookLeaf's distribution record/);
    expect(f?.display).toMatch(/confirm/);
  });

  it('a platform in the record is reported as such', () => {
    const p = pack('AUTH001', 'BK001', 'not available on flipkart');
    expect(fact(p, 'book.BK001.platform.flipkart')?.display).toMatch(
      /is in BookLeaf's distribution record/,
    );
  });
});

describe('isolation', () => {
  it('a book id belonging to another author yields no book facts', () => {
    const p = pack('AUTH001', 'BK003');
    expect(p.facts.some((f) => f.id.startsWith('book.BK003'))).toBe(false);
  });
});
