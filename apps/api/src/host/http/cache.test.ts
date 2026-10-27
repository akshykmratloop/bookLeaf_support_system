import { describe, expect, it } from 'vitest';
import { ttlCache } from './cache.js';

describe('ttlCache', () => {
  it('forgets an entry once it is too old', () => {
    let now = 0;
    const cache = ttlCache<string>(1000, () => now, 10);
    cache.set('a', 'A');
    expect(cache.get('a')).toBe('A');
    now = 1000;
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size()).toBe(0);
  });

  it('holds at most maxEntries, dropping the oldest first', () => {
    const cache = ttlCache<number>(60_000, () => 0, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect([cache.get('b'), cache.get('c')]).toEqual([2, 3]);
  });
});
