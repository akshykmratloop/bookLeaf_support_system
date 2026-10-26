/**
 * Royalty payout calendar (KB): royalties are calculated per calendar quarter and paid within
 * 45 days of the quarter ending. All functions are pure and work in UTC.
 */
export const PAYOUT_WINDOW_DAYS = 45;
const DAY_MS = 86_400_000;

export function quarterEnd(date: Date): Date {
  const year = date.getUTCFullYear();
  const lastMonthOfQuarter = Math.floor(date.getUTCMonth() / 3) * 3 + 2;
  return new Date(Date.UTC(year, lastMonthOfQuarter + 1, 0));
}

export function payoutDeadlineFor(date: Date): Date {
  return addDays(quarterEnd(date), PAYOUT_WINDOW_DAYS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}
