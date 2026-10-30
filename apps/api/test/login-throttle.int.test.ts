import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOGIN_ATTEMPTS_PER_ACCOUNT } from '../src/modules/auth/login-throttle.js';
import { createHarness, EMAILS, type Harness } from './helpers/app.js';
import { seedSuperAdmin, SUPER } from './helpers/platform.js';

/**
 * Password guessing is limited per account, wherever the attempts come from: every attempt
 * here uses a new client address, so only the per-account counter can stop them.
 */
let h: Harness;
let address = 0;

const fromNewAddress = (url: string, email: string, password: string) =>
  h.app.inject({
    method: 'POST',
    url: `/api/v1${url}`,
    remoteAddress: `198.51.100.${(address += 1) % 250}`,
    payload: { email, password },
  });

beforeAll(async () => {
  h = await createHarness();
  await seedSuperAdmin(h);
});
afterAll(() => h.close());

describe('staff sign-in is limited per account', () => {
  it('refuses further attempts on one account after the limit, from any address', async () => {
    const email = `guess-${Date.now()}@bookleaf.demo`;
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_ACCOUNT; i += 1) {
      const res = await fromNewAddress('/auth/login', email, `Wrong-Guess-${i}-xx`);
      expect(res.statusCode).toBe(401);
    }
    const blocked = await fromNewAddress('/auth/login', ` ${email.toUpperCase()}`, 'Wrong-x-12345');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ code: string }>().code).toBe('LOGIN_LOCKED');
  });

  it('counts unknown and real accounts the same way (no hint that an account exists)', async () => {
    const unknown = `nobody-${Date.now()}@bookleaf.demo`;
    for (let i = 0; i <= LOGIN_ATTEMPTS_PER_ACCOUNT; i += 1)
      await fromNewAddress('/auth/login', unknown, 'Wrong-Guess-xx-1');
    const res = await fromNewAddress('/auth/login', unknown, 'Wrong-Guess-xx-1');
    expect(res.statusCode).toBe(429);
  });

  it('does not lock other accounts', async () => {
    const res = await fromNewAddress('/auth/login', EMAILS.admin, 'Wrong-Guess-xx-2');
    expect(res.statusCode).toBe(401);
  });
});

describe('super admin sign-in is limited per account', () => {
  it('refuses further attempts after the limit, from any address', async () => {
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_ACCOUNT; i += 1)
      await fromNewAddress('/platform/auth/login', SUPER.email, `Wrong-Guess-${i}-yy`);
    const res = await fromNewAddress('/platform/auth/login', SUPER.email, SUPER.password);
    expect(res.statusCode).toBe(429);
  });
});
