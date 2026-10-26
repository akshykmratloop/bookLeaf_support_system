/**
 * The only place the app reads the time.
 * - now(): real wall-clock time (timestamps, SLA, job scheduling).
 * - dataAsOf(): the snapshot date of the business data (all royalty / payout maths).
 */
export interface Clock {
  now(): Date;
  dataAsOf(): Date;
}

export function systemClock(dataAsOf: string): Clock {
  const asOf = parseIsoDate(dataAsOf);
  return { now: () => new Date(), dataAsOf: () => new Date(asOf.getTime()) };
}

export function fixedClock(now: string, dataAsOf: string): Clock {
  const n = new Date(now);
  const asOf = parseIsoDate(dataAsOf);
  return { now: () => new Date(n.getTime()), dataAsOf: () => new Date(asOf.getTime()) };
}

/** Parses YYYY-MM-DD as a UTC midnight date. */
export function parseIsoDate(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
