import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, deleteWorkspace, EMAILS, type Harness } from './helpers/app.js';

/**
 * F-12 part 1: a staff email has exactly one account on the whole platform, so email + password
 * always names one account and one workspace. Authors are not affected (see connectors.int).
 */
let h: Harness;

const OWNER = {
  workspaceName: 'Unique Login Co',
  slug: 'unique-login',
  ownerName: 'Uma Owner',
  email: 'uma@unique-login.example',
  password: 'Correct-Horse-42',
};

const signup = (body: Record<string, unknown>) => call(h, 'POST', '/signup', undefined, body);
const login = (email: string, password: string) =>
  call(h, 'POST', '/auth/login', undefined, { email, password });

beforeAll(async () => {
  h = await createHarness();
  await deleteWorkspace(h.db, OWNER.slug);
  await deleteWorkspace(h.db, 'unique-login-2');
  await deleteWorkspace(h.db, 'unique-login-3');
});
afterAll(async () => {
  await deleteWorkspace(h.db, OWNER.slug);
  await deleteWorkspace(h.db, 'unique-login-2');
  await deleteWorkspace(h.db, 'unique-login-3');
  await h.close();
});

describe('signup with an email that already has an account', () => {
  it('stores the owner email trimmed and lowercased as the login email', async () => {
    const res = await signup({ ...OWNER, email: `  ${OWNER.email.toUpperCase()} ` });
    expect(res.statusCode).toBe(201);
    const user = await h.db.user.findFirstOrThrow({ where: { workspace: { slug: OWNER.slug } } });
    expect(user.email).toBe(OWNER.email);
    expect(user.loginEmail).toBe(OWNER.email);
  });

  it('refuses the same email for a second workspace (409), in any case, and creates nothing', async () => {
    for (const [slug, email] of [
      ['unique-login-2', OWNER.email],
      ['unique-login-3', ` ${OWNER.email.toUpperCase()}`],
    ] as const) {
      const res = await signup({ ...OWNER, slug, email });
      expect(res.statusCode).toBe(409);
      const body = res.json<{ code: string; title: string }>();
      expect(body.code).toBe('EMAIL_TAKEN');
      expect(body.title).toContain('already has an account');
      expect(await h.db.workspace.count({ where: { slug } })).toBe(0);
    }
  });

  it("refuses a seeded staff member's email (409)", async () => {
    const res = await signup({ ...OWNER, slug: 'unique-login-2', email: EMAILS.admin });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('EMAIL_TAKEN');
  });
});

describe('staff login (email + password only)', () => {
  it('signs in with the email in any case and with spaces, into the right workspace', async () => {
    const res = await login(`  ${OWNER.email.toUpperCase()}  `, OWNER.password);
    expect(res.statusCode).toBe(200);
    const cookie = `bl_session=${res.cookies.find((c) => c.name === 'bl_session')?.value}`;
    const mine = await call(h, 'GET', '/workspace', cookie);
    expect(mine.json()).toMatchObject({ workspace: { slug: OWNER.slug }, role: 'OWNER' });
  });

  it('refuses a wrong password and an unknown email with the same 401', async () => {
    const wrong = await login(OWNER.email, 'Wrong-Horse-42');
    const unknown = await login('nobody@unique-login.example', OWNER.password);
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json<{ title: string }>().title).toBe(unknown.json<{ title: string }>().title);
  });

  it('the seeded admins have a login email and still sign in', async () => {
    const admin = await h.db.user.findFirstOrThrow({ where: { email: EMAILS.admin } });
    expect(admin.loginEmail).toBe(EMAILS.admin);
    await expect(h.login(EMAILS.admin)).resolves.toContain('bl_session=');
  });
});
