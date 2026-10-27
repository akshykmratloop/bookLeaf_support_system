/** A small time-limited cache: an entry is reused until it is `ttlMs` old. */
export function ttlCache<T>(ttlMs: number, now: () => number) {
  const entries = new Map<string, { value: T; at: number }>();
  return {
    get(key: string): T | undefined {
      const hit = entries.get(key);
      if (!hit || now() - hit.at >= ttlMs) return undefined;
      return hit.value;
    },
    set(key: string, value: T): void {
      entries.set(key, { value, at: now() });
    },
  };
}
