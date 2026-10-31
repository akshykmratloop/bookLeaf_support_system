import { describe, expect, it } from 'vitest';
import { dayRange, startOfDay } from './day-range.js';

describe('day boundaries in a time zone', () => {
  it('starts a day at local midnight', () => {
    expect(startOfDay('2026-11-01', 'UTC').toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(startOfDay('2026-11-01', 'Asia/Kolkata').toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(startOfDay('2026-11-01', 'America/New_York').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    );
  });

  it('follows daylight saving: the day after the change starts an hour later in UTC', () => {
    // US clocks go back at 02:00 on 1 Nov 2026: EDT (-4) before, EST (-5) after.
    expect(startOfDay('2026-11-02', 'America/New_York').toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
    expect(startOfDay('2026-03-29', 'Europe/London').toISOString()).toBe(
      '2026-03-29T00:00:00.000Z',
    );
    expect(startOfDay('2026-03-30', 'Europe/London').toISOString()).toBe(
      '2026-03-29T23:00:00.000Z',
    );
  });

  it('makes an inclusive range that ends at the start of the next day', () => {
    const r = dayRange('2026-10-31', '2026-10-31', 'Asia/Kolkata');
    expect(r.gte?.toISOString()).toBe('2026-10-30T18:30:00.000Z');
    expect(r.lt?.toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(dayRange(undefined, undefined, 'UTC')).toEqual({});
  });
});
