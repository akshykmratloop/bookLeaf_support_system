import { UsageLimitError } from '../../platform/errors.js';
import type { RateCounters } from '../../platform/shared-state/types.js';

/** Sign-in attempts allowed for one account in one window, from all addresses together. */
export const LOGIN_ATTEMPTS_PER_ACCOUNT = 10;
export const LOGIN_WINDOW_MS = 15 * 60_000;

/** Counts one sign-in attempt for `email` in `area` ('staff' or 'platform'); 429 past the limit. */
export type LoginThrottle = (area: string, email: string) => Promise<void>;

/**
 * Limits password guessing per account, on every copy of the API (shared counters). The
 * per-address limit on the route is only a loose backstop: behind a proxy many people share one
 * address, and an attacker can use many. Unknown emails are counted the same way, so the answer
 * never shows whether an account exists.
 */
export function loginThrottle(counters: RateCounters): LoginThrottle {
  return async (area, email) => {
    const key = `login:${area}:${email.trim().toLowerCase()}`;
    const { count, resetInMs } = await counters.hit(key, LOGIN_WINDOW_MS);
    if (count <= LOGIN_ATTEMPTS_PER_ACCOUNT) return;
    const minutes = Math.max(1, Math.ceil(resetInMs / 60_000));
    throw new UsageLimitError(
      'LOGIN_LOCKED',
      `Too many sign-in attempts for this account. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    );
  };
}
