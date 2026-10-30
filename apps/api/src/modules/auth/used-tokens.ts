import type { Clock } from '../../platform/clock.js';
import type { OneTimeClaims } from '../../platform/shared-state/types.js';

/**
 * Remembers the ids (`jti`) of one-use tokens until they expire, so each token works once on the
 * whole platform, whichever copy of the API it reaches (F-19). `kind` keeps the host sign-in
 * tokens and the voice call tickets apart.
 */
export function usedTokenIds(claims: OneTimeClaims, clock: Clock, kind: string) {
  return {
    /** True the first time an id is seen; false for a replay. */
    claim(id: string, exp: number): Promise<boolean> {
      const nowSeconds = Math.floor(clock.now().getTime() / 1000);
      return claims.claim(`used-token:${kind}:${id}`, Math.max(1, exp - nowSeconds));
    },
  };
}

export type UsedTokenIds = ReturnType<typeof usedTokenIds>;
