import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb } from '../src/platform/db.js';
import { ensurePlatformAdmin } from '../src/modules/platform/admins.js';
import { call, createHarness, EMAILS, type Harness } from './helpers/app.js';
import { platformCookie, platformLogin, seedSuperAdmin, SUPER } from './helpers/platform.js';

/**
 * U-7: the super admin console has its own accounts, sign-in, cookie and token audience. A
 * customer session never opens /platform APIs and a platform session never opens customer APIs.
 */
let h: Harness;
let admin: string;
let author: string;

beforeAll(async () => {
  h = await createHarness();
  await seedSuperAdmin(h);
  [admin, author] = await Promise.all([h.login(EMAILS.admin), h.login(EMAILS.priya)]);
});
afterAll(() => h.close());

describe('super admin sign-in (U-7)', () => {
  it('signs in with the seeded email and password and says who is signed in', async () => {
    const bad = await call(h, 'POST', '/platform/auth/login', undefined, {
      email: SUPER.email,
      password: 'wrong-password-1',
    });
    expect(bad.statusCode).toBe(401);
    const cookie = await platformLogin(h, ` ${SUPER.email.toUpperCase()} `);
    const me = await call(h, 'GET', '/platform/auth/me', cookie);
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ admin: { email: SUPER.email } });
  });

  it('is created and updated idempotently from env: one row, the newest password works', async () => {
    await ensurePlatformAdmin(h.db, { email: SUPER.email, password: 'Rotated-Password-77' });
    await ensurePlatformAdmin(h.db, { email: SUPER.email, password: 'Rotated-Password-77' });
    expect(await h.db.platformAdmin.count({ where: { email: SUPER.email } })).toBe(1);
    await expect(platformLogin(h)).rejects.toThrow('401');
    const cookie = await platformLogin(h, SUPER.email, 'Rotated-Password-77');
    expect((await call(h, 'GET', '/platform/auth/me', cookie)).statusCode).toBe(200);
    await seedSuperAdmin(h);
  });

  it('refuses a weak env password instead of creating a guessable account', async () => {
    await expect(
      ensurePlatformAdmin(h.db, { email: 'weak@support.example', password: 'short' }),
    ).rejects.toThrow();
    expect(await h.db.platformAdmin.count({ where: { email: 'weak@support.example' } })).toBe(0);
  });

  it('signs out on every device: the old platform cookie stops working', async () => {
    const cookie = await platformCookie(h);
    expect((await call(h, 'POST', '/platform/auth/logout', cookie)).statusCode).toBe(204);
    expect((await call(h, 'GET', '/platform/auth/me', cookie)).statusCode).toBe(401);
  });
});

describe('two areas, two sessions (U-7)', () => {
  it('a customer staff or author session gets 403 on /platform APIs; no session gets 401', async () => {
    for (const cookie of [admin, author]) {
      expect((await call(h, 'GET', '/platform/customers', cookie)).statusCode).toBe(403);
      expect((await call(h, 'GET', '/platform/ai', cookie)).statusCode).toBe(403);
    }
    expect((await call(h, 'GET', '/platform/customers', undefined)).statusCode).toBe(401);
  });

  it('a platform session gets 403 on customer APIs, and its token is no customer token', async () => {
    const platform = await platformCookie(h);
    expect((await call(h, 'GET', '/tickets', platform)).statusCode).toBe(403);
    expect((await call(h, 'GET', '/workspace/settings', platform)).statusCode).toBe(403);
    const asCustomer = platform.replace('bl_platform=', 'bl_session=');
    expect((await call(h, 'GET', '/tickets', asCustomer)).statusCode).toBe(401);
    const asPlatform = admin.replace('bl_session=', 'bl_platform=');
    expect((await call(h, 'GET', '/platform/customers', asPlatform)).statusCode).toBe(401);
  });
});

describe('platform tables are the owner’s only (U-7)', () => {
  it('the restricted app role cannot read or write them at all', async () => {
    const app = createDb(inject('databaseUrl'));
    try {
      for (const table of [
        'platform_admins',
        'platform_settings',
        'platform_provider_keys',
        'workspace_plans',
      ])
        await expect(app.$queryRawUnsafe(`SELECT count(*) FROM "${table}"`)).rejects.toThrow(
          /permission denied/,
        );
    } finally {
      await app.$disconnect();
    }
  });
});
