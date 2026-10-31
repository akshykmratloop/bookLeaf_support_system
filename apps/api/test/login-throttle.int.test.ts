import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOGIN_FAILURES_PER_BUCKET } from '../src/modules/auth/login-throttle.js';
import { createHarness, deleteWorkspace, type Harness } from './helpers/app.js';
import { seedSuperAdmin, SUPER } from './helpers/platform.js';
import { ownerOf, signupWorkspace } from './helpers/workspaces.js';

/**
 * Failed sign-ins are limited per browser (device cookie) and, for browsers we do not know, per
 * account. Every attempt uses a new client address unless a test says otherwise, so only these
 * counters can stop them, and an outsider can never lock the owner's own browser.
 */
let h: Harness;
let address = 0;
const slugs: string[] = [];

const nextAddress = () => `198.51.100.${((address += 1) % 250) + 1}`;

const attempt = (
  url: string,
  email: string,
  password: string,
  device?: Record<string, string>,
  ip?: string,
) =>
  h.app.inject({
    method: 'POST',
    url: `/api/v1${url}`,
    remoteAddress: ip ?? nextAddress(),
    ...(device ? { cookies: device } : {}),
    payload: { email, password },
  });

/** A fresh staff account (its own workspace), so no test shares a bucket with another. */
async function newStaff(): Promise<{ email: string; password: string }> {
  const slug = `throttle-${randomUUID().slice(0, 8)}`;
  slugs.push(slug);
  const owner = ownerOf(slug, 'Throttle Co');
  await signupWorkspace(h, owner);
  return { email: owner.email, password: owner.password };
}

const deviceOf = (res: Awaited<ReturnType<typeof attempt>>, name: string) => {
  const cookie = res.cookies.find((c) => c.name === name);
  if (!cookie) throw new Error(`no ${name} cookie`);
  return { [name]: cookie.value };
};

const failTimes = async (n: number, url: string, email: string) => {
  for (let i = 0; i < n; i += 1)
    expect((await attempt(url, email, `Wrong-Guess-${i}-xx`)).statusCode).toBe(401);
};

beforeAll(async () => {
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: '30' } });
  await seedSuperAdmin(h);
});
afterAll(async () => {
  for (const slug of slugs) await deleteWorkspace(h.db, slug);
  await h.close();
});

describe('staff sign-in: failures lock per browser, successes never do', () => {
  it('signs in 12 times in a row without locking, and remembers the browser', async () => {
    const staff = await newStaff();
    for (let i = 0; i < 12; i += 1)
      expect((await attempt('/auth/login', staff.email, staff.password)).statusCode).toBe(200);
    const res = await attempt('/auth/login', staff.email, staff.password);
    const cookie = res.cookies.find((c) => c.name === 'bl_device');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', maxAge: 90 * 24 * 3600 });
  });

  it('locks unknown browsers after 10 failures, from any address and any spelling', async () => {
    const staff = await newStaff();
    await failTimes(LOGIN_FAILURES_PER_BUCKET, '/auth/login', staff.email);
    const blocked = await attempt('/auth/login', ` ${staff.email.toUpperCase()}`, staff.password);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ code: string }>().code).toBe('LOGIN_LOCKED');
  });

  it('lets the owner’s remembered browser in while unknown browsers are locked', async () => {
    const staff = await newStaff();
    const device = deviceOf(await attempt('/auth/login', staff.email, staff.password), 'bl_device');
    await failTimes(LOGIN_FAILURES_PER_BUCKET, '/auth/login', staff.email);
    expect((await attempt('/auth/login', staff.email, staff.password)).statusCode).toBe(429);
    const mine = await attempt('/auth/login', staff.email, staff.password, device);
    expect(mine.statusCode).toBe(200);
  });

  it('a success empties the bucket, so earlier failures stop counting', async () => {
    const staff = await newStaff();
    await failTimes(LOGIN_FAILURES_PER_BUCKET - 1, '/auth/login', staff.email);
    expect((await attempt('/auth/login', staff.email, staff.password)).statusCode).toBe(200);
    await failTimes(LOGIN_FAILURES_PER_BUCKET, '/auth/login', staff.email);
    expect((await attempt('/auth/login', staff.email, staff.password)).statusCode).toBe(429);
  });

  it('ignores a device cookie from another account', async () => {
    const [mine, other] = [await newStaff(), await newStaff()];
    const device = deviceOf(await attempt('/auth/login', other.email, other.password), 'bl_device');
    await failTimes(LOGIN_FAILURES_PER_BUCKET, '/auth/login', mine.email);
    const res = await attempt('/auth/login', mine.email, mine.password, device);
    expect(res.statusCode).toBe(429);
  });

  it('counts unknown and real accounts the same way (no hint that an account exists)', async () => {
    const unknown = `nobody-${randomUUID()}@bookleaf.demo`;
    await failTimes(LOGIN_FAILURES_PER_BUCKET, '/auth/login', unknown);
    const res = await attempt('/auth/login', unknown, 'Wrong-Guess-xx-1');
    expect(res.statusCode).toBe(429);
    expect(res.json<{ code: string }>().code).toBe('LOGIN_LOCKED');
  });
});

describe('the per-address backstop is per address and email', () => {
  it('one visitor hitting the limit does not block another email on the same address', async () => {
    const ip = '192.0.2.77';
    const busy = `busy-${randomUUID()}@bookleaf.demo`;
    for (let i = 0; i < 20; i += 1)
      await attempt('/auth/login', busy, 'Wrong-Guess-xx-9', undefined, ip);
    expect((await attempt('/auth/login', busy, 'Wrong-Guess-xx-9', undefined, ip)).statusCode).toBe(
      429,
    );
    const staff = await newStaff();
    const other = await attempt('/auth/login', staff.email, staff.password, undefined, ip);
    expect(other.statusCode).toBe(200);
  });
});

describe('super admin sign-in uses its own device cookie the same way', () => {
  it('locks unknown browsers after 10 failures but not the remembered one', async () => {
    const first = await attempt('/platform/auth/login', SUPER.email, SUPER.password);
    expect(first.statusCode).toBe(200);
    const device = deviceOf(first, 'bl_platform_device');
    await failTimes(LOGIN_FAILURES_PER_BUCKET, '/platform/auth/login', SUPER.email);
    expect((await attempt('/platform/auth/login', SUPER.email, SUPER.password)).statusCode).toBe(
      429,
    );
    const staffCookie = { bl_device: device.bl_platform_device! };
    const crossArea = await attempt(
      '/platform/auth/login',
      SUPER.email,
      SUPER.password,
      staffCookie,
    );
    expect(crossArea.statusCode).toBe(429);
    const mine = await attempt('/platform/auth/login', SUPER.email, SUPER.password, device);
    expect(mine.statusCode).toBe(200);
  });
});
