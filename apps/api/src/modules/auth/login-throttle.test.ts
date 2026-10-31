import { describe, expect, it } from 'vitest';
import { UnauthorizedError, UsageLimitError } from '../../platform/errors.js';
import { memoryBackend } from '../../platform/shared-state/memory/index.js';
import { createDeviceTokens, type LoginArea } from './device-token.js';
import { LOGIN_FAILURES_PER_BUCKET, loginThrottle } from './login-throttle.js';

const SECRET = 'unit-test-jwt-secret-that-is-long-enough-123';
const EMAIL = 'admin@bookleaf.demo';

function setup() {
  const clock = { now: () => new Date(), dataAsOf: () => new Date('2025-12-31T00:00:00Z') };
  const devices = createDeviceTokens(SECRET, clock);
  const throttle = loginThrottle(memoryBackend(Date.now).counters, devices);
  const ok = (area: LoginArea, email: string, deviceToken?: string) =>
    throttle.guard({ area, email, deviceToken }, async () => 'signed in');
  const fail = (area: LoginArea, email: string, deviceToken?: string) =>
    throttle.guard({ area, email, deviceToken }, async () => {
      throw new UnauthorizedError('Invalid email or password');
    });
  return { devices, ok, fail };
}

const failTimes = async (n: number, attempt: () => Promise<unknown>) => {
  for (let i = 0; i < n; i += 1) await expect(attempt()).rejects.toBeInstanceOf(UnauthorizedError);
};

describe('login throttle', () => {
  it('never locks an account that keeps signing in successfully', async () => {
    const { ok } = setup();
    for (let i = 0; i < 12; i += 1) await expect(ok('staff', EMAIL)).resolves.toBeTruthy();
  });

  it('locks unknown browsers after 10 failures, for any spelling of the email', async () => {
    const { ok, fail } = setup();
    await failTimes(LOGIN_FAILURES_PER_BUCKET, () => fail('staff', EMAIL));
    await expect(ok('staff', ` ${EMAIL.toUpperCase()}`)).rejects.toMatchObject({
      code: 'LOGIN_LOCKED',
    });
  });

  it('lets a browser that signed in before through while unknown browsers are locked', async () => {
    const { ok, fail } = setup();
    const { deviceToken } = await ok('staff', EMAIL);
    await failTimes(LOGIN_FAILURES_PER_BUCKET, () => fail('staff', EMAIL));
    await expect(fail('staff', EMAIL)).rejects.toBeInstanceOf(UsageLimitError);
    await expect(ok('staff', EMAIL, deviceToken)).resolves.toMatchObject({ result: 'signed in' });
  });

  it('empties the bucket on success, so earlier failures stop counting', async () => {
    const { ok, fail } = setup();
    await failTimes(LOGIN_FAILURES_PER_BUCKET - 1, () => fail('staff', EMAIL));
    await ok('staff', EMAIL);
    await failTimes(LOGIN_FAILURES_PER_BUCKET, () => fail('staff', EMAIL));
    await expect(fail('staff', EMAIL)).rejects.toBeInstanceOf(UsageLimitError);
  });

  it('ignores a device token from another email or another area', async () => {
    const { devices, ok, fail } = setup();
    const otherEmail = await devices.issue('staff', 'someone@bookleaf.demo');
    const otherArea = await devices.issue('platform', EMAIL);
    await failTimes(LOGIN_FAILURES_PER_BUCKET, () => fail('staff', EMAIL));
    await expect(ok('staff', EMAIL, otherEmail)).rejects.toBeInstanceOf(UsageLimitError);
    await expect(ok('staff', EMAIL, otherArea)).rejects.toBeInstanceOf(UsageLimitError);
    await expect(ok('staff', EMAIL, 'not-a-token')).rejects.toBeInstanceOf(UsageLimitError);
  });

  it('locks a remembered browser after its own 10 failures', async () => {
    const { ok, fail } = setup();
    const { deviceToken } = await ok('platform', EMAIL);
    await failTimes(LOGIN_FAILURES_PER_BUCKET, () => fail('platform', EMAIL, deviceToken));
    await expect(ok('platform', EMAIL, deviceToken)).rejects.toBeInstanceOf(UsageLimitError);
    await expect(ok('platform', EMAIL)).resolves.toBeTruthy();
  });
});
