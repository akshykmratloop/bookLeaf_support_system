/**
 * A small time-limited cache: an entry is reused until it is `ttlMs` old. Expired entries are
 * dropped when read, and the oldest entry goes first once `maxEntries` is reached.
 */
export function ttlCache<T>(ttlMs: number, now: () => number, maxEntries = 1000) {
  const entries = new Map<string, { value: T; at: number }>();
  return {
    get(key: string): T | undefined {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (now() - hit.at < ttlMs) return hit.value;
      entries.delete(key);
      return undefined;
    },
    set(key: string, value: T): void {
      entries.delete(key);
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value ?? '');
      entries.set(key, { value, at: now() });
    },
    size: () => entries.size,
  };
}
