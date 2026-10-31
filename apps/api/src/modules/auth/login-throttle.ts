import { UsageLimitError } from '../../platform/errors.js';
import type { RateCounters } from '../../platform/shared-state/types.js';
import type { DeviceTokens, LoginArea } from './device-token.js';

/** Failed sign-ins allowed per bucket in one window, from all copies of the API together. */
export const LOGIN_FAILURES_PER_BUCKET = 10;
export const LOGIN_WINDOW_MS = 15 * 60_000;

/** One sign-in attempt: the area, the email typed, and the browser's device cookie (if any). */
export interface LoginAttempt {
  area: LoginArea;
  email: string;
  deviceToken: string | undefined;
}

export interface GuardedLogin<T> {
  result: T;
  /** A fresh device token for the browser that just signed in. */
  deviceToken: string;
}

export interface LoginThrottle {
  /** Runs `signIn` unless this bucket is locked (429); a success empties the bucket. */
  guard<T>(attempt: LoginAttempt, signIn: () => Promise<T>): Promise<GuardedLogin<T>>;
}

const locked = (resetInMs: number) => {
  const minutes = Math.max(1, Math.ceil(resetInMs / 60_000));
  return new UsageLimitError(
    'LOGIN_LOCKED',
    `Too many sign-in attempts for this account. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  );
};

/**
 * Limits password guessing without letting outsiders lock an account (OWASP "device cookie").
 * A browser that signed in to this email before has its own bucket; every other browser shares
 * the email's "untrusted" bucket. So guessing from new browsers still stops after 10 tries, but
 * it cannot lock out the owner's own browser. The attempt is counted before the password is
 * checked (safe under concurrency) and a success clears it, so successes never add up. Unknown
 * emails are counted the same way, so the answer never shows whether an account exists.
 */
export function loginThrottle(counters: RateCounters, devices: DeviceTokens): LoginThrottle {
  return {
    async guard(attempt, signIn) {
      const email = attempt.email.trim().toLowerCase();
      const deviceId = await devices.deviceIdOf(attempt.area, email, attempt.deviceToken);
      const key = deviceId
        ? `login:${attempt.area}:device:${deviceId}`
        : `login:${attempt.area}:untrusted:${email}`;
      const { count, resetInMs } = await counters.hit(key, LOGIN_WINDOW_MS);
      if (count > LOGIN_FAILURES_PER_BUCKET) throw locked(resetInMs);
      const result = await signIn();
      await counters.clear(key);
      return {
        result,
        deviceToken: await devices.issue(attempt.area, email, deviceId ?? undefined),
      };
    },
  };
}
