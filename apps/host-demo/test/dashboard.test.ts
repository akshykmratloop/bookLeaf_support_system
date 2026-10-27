import { describe, expect, it } from 'vitest';
import { findById } from '../src/data/authors.js';
import { buildDashboard } from '../src/dashboard/build.js';
import { DashboardSchema } from '../src/dashboard/schema.js';
import { AUTHORS } from './fixtures.js';

const AS_OF = new Date('2025-12-31T00:00:00Z');
const dashboardOf = (id: string) => {
  const account = findById(AUTHORS, id);
  if (!account) throw new Error(id);
  return DashboardSchema.parse(buildDashboard(account, AS_OF));
};

describe('buildDashboard', () => {
  it('adds up the books and keeps all ten book fields', () => {
    const d = dashboardOf('AUTH001');
    expect(d.profile).toMatchObject({
      name: 'Priya Sharma',
      city: 'Mumbai',
      memberSince: '2023-03-15',
    });
    expect(d.totals).toEqual({
      books: 2,
      liveBooks: 2,
      inProduction: 0,
      copiesSold: 531,
      earnedPaise: 1_990_800,
      paidPaise: 1_633_800,
      pendingPaise: 357_000,
    });
    expect(d.books[0]).toMatchObject({
      id: 'BK001',
      isbn: '978-93-5XXXX-01-1',
      mrpPaise: 39_900,
      royaltyPerCopyPaise: 3_500,
      printPartner: 'In-House',
      availableOn: ['Amazon India', 'Flipkart', 'BookLeaf Store'],
      live: true,
    });
  });

  it('shows progress to the payout threshold for an author below it', () => {
    const d = dashboardOf('AUTH009');
    expect(d.payout).toMatchObject({
      eligible: false,
      progressPercent: 85,
      nextCycleDeadline: '2026-02-14',
      daysToDeadline: 45,
      overdueBookIds: [],
    });
  });

  it('flags a book with no payout after its deadline as possibly overdue', () => {
    const d = dashboardOf('AUTH010');
    expect(d.payout.overdueBookIds).toEqual(['BK018']);
    expect(d.books.find((b) => b.id === 'BK018')?.overdueDays).toBeGreaterThan(0);
  });

  it('places a book in production on its stage', () => {
    const book = dashboardOf('AUTH007').books.find((b) => b.id === 'BK013');
    expect(book).toMatchObject({ stage: 'COVER_DESIGN', stageIndex: 2, live: false });
    expect(dashboardOf('AUTH007').totals.inProduction).toBe(1);
  });
});
