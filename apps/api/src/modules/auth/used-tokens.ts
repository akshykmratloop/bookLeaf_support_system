import type { Clock } from '../../platform/clock.js';

/**
 * Remembers the ids (`jti`) of host sign-in tokens until they expire, so each token signs in
 * once. Kept in memory: the module runs as a single instance (see docs/architecture.md).
 */
export function usedTokenIds(clock: Clock) {
  const expiresAt = new Map<string, number>();
  const forgetExpired = (nowSeconds: number) => {
    for (const [id, exp] of expiresAt) if (exp <= nowSeconds) expiresAt.delete(id);
  };
  return {
    /** True the first time an id is seen; false for a replay. */
    claim(id: string, exp: number): boolean {
      forgetExpired(Math.floor(clock.now().getTime() / 1000));
      if (expiresAt.has(id)) return false;
      expiresAt.set(id, exp);
      return true;
    },
  };
}

export type UsedTokenIds = ReturnType<typeof usedTokenIds>;
