import { describe, expect, it } from 'vitest';
import {
  allItems,
  browserTimeZone,
  keys,
  nextCursorOf,
  TICKET_PAGE_SIZE,
  ticketListPath,
} from './queries';

const params = (path: string) => new URL(path, 'http://x').searchParams;

describe('ticket list pages', () => {
  it('asks for 50 tickets at a time, with the cursor only after the first page', () => {
    expect(TICKET_PAGE_SIZE).toBe(50);
    expect(ticketListPath({}, null)).toBe('/tickets?limit=50');
    const next = params(ticketListPath({}, 'c0ffee00-0000-4000-8000-000000000001'));
    expect(next.get('limit')).toBe('50');
    expect(next.get('cursor')).toBe('c0ffee00-0000-4000-8000-000000000001');
  });

  it('sends the filters (empty ones left out) and the time zone', () => {
    const path = ticketListPath(
      { status: 'OPEN', q: '', sort: 'oldest', tz: 'Asia/Kolkata' },
      null,
    );
    const p = params(path);
    expect(p.get('status')).toBe('OPEN');
    expect(p.get('sort')).toBe('oldest');
    expect(p.get('tz')).toBe('Asia/Kolkata');
    expect(p.has('q')).toBe(false);
    expect(p.has('cursor')).toBe(false);
  });

  it('stops when the API has no next cursor', () => {
    expect(nextCursorOf({ items: [], nextCursor: 'abc' })).toBe('abc');
    expect(nextCursorOf({ items: [], nextCursor: null })).toBeUndefined();
  });

  it('shows every loaded page as one list, in order', () => {
    const data = {
      pages: [
        { items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'b' },
        { items: [{ id: 'c' }], nextCursor: null },
      ],
      pageParams: [null, 'b'],
    };
    expect(allItems(data).items.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps one cache entry per filter set, under the shared tickets prefix', () => {
    expect(keys.tickets({ status: 'OPEN' })).toEqual(['tickets', { status: 'OPEN' }]);
    expect(keys.tickets()[0]).toBe('tickets');
  });

  it('reads the browser time zone as an IANA name', () => {
    expect(browserTimeZone()).toMatch(/^[A-Za-z_]+(\/[A-Za-z_+-]+)*$|^UTC$/);
  });
});
