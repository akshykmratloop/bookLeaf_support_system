import { HOST_TOKEN_AUDIENCE, type AuthUser, type BookList } from '@bookleaf/shared';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { syncCustomer } from '../src/host/sync.js';
import { sampleCustomer } from './fixtures/host.js';
import { call, createHarness, EMAILS, HOST, type Harness } from './helpers/app.js';

let h: Harness;

interface TokenOptions {
  sub?: string;
  secret?: string;
  audience?: string;
  issuedAgo?: number;
  lifetime?: number;
  extra?: Record<string, unknown>;
}

/** A hand-over token as a host would make it; each option bends one rule. */
function token(o: TokenOptions = {}) {
  const iat = Math.floor(h.clock.now().getTime() / 1000) - (o.issuedAgo ?? 0);
  return new SignJWT({ name: 'Priya Sharma', email: EMAILS.priya, ...o.extra })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(o.sub ?? 'AUTH001')
    .setAudience(o.audience ?? HOST_TOKEN_AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + (o.lifetime ?? 300))
    .sign(new TextEncoder().encode(o.secret ?? HOST.signingSecret));
}

const signIn = async (o: TokenOptions = {}) =>
  call(h, 'POST', '/auth/host', undefined, { token: await token(o) });

beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

describe('POST /auth/host', () => {
  it('signs a host author in and keeps reference rows for them and their books', async () => {
    const res = await signIn();
    expect(res.statusCode).toBe(200);
    expect(res.json<{ user: AuthUser }>().user).toMatchObject({
      role: 'AUTHOR',
      name: 'Priya Sharma',
    });
    expect(res.cookies.find((c) => c.name === 'bl_session')?.httpOnly).toBe(true);
    const author = await h.db.author.findUniqueOrThrow({
      where: { externalId: 'AUTH001' },
      include: { books: true, user: true },
    });
    expect(author.books.map((b) => b.externalId).sort()).toEqual(['BK001', 'BK002']);
    expect(author.user.passwordHash).toBeNull();
  });

  it.each<[string, TokenOptions]>([
    ['an expired token', { issuedAgo: 600 }],
    ['a token signed with another secret', { secret: 'some-other-secret-that-is-long-enough-123' }],
    ['a token meant for someone else', { audience: 'billing' }],
    ['a token that lives longer than five minutes', { lifetime: 3600 }],
    ['an account the host does not know', { sub: 'AUTH999' }],
  ])('refuses %s (401)', async (_name, o) => {
    expect((await signIn(o)).statusCode).toBe(401);
  });

  it('ignores a role claim: host users are always authors', async () => {
    const res = await signIn({ extra: { role: 'ADMIN' } });
    expect(res.json<{ user: AuthUser }>().user.role).toBe('AUTHOR');
  });

  it('rejects a malformed body (422)', async () => {
    expect((await call(h, 'POST', '/auth/host', undefined, { token: 'x' })).statusCode).toBe(422);
  });
});

describe('accounts', () => {
  it('a host author has no password here, so password sign-in never works for them', async () => {
    await signIn();
    const res = await call(h, 'POST', '/auth/login', undefined, {
      email: EMAILS.priya,
      password: 'Author@Test1',
    });
    expect(res.statusCode).toBe(401);
  });

  it("refuses a host customer whose email is a support admin's (409)", async () => {
    const intruder = { ...sampleCustomer('AUTH001'), id: 'AUTH-X', email: EMAILS.admin, items: [] };
    await expect(syncCustomer(h.db, intruder)).rejects.toMatchObject({ code: 'EMAIL_IN_USE' });
  });

  it('tells the login page where authors sign in (not configured here)', async () => {
    const res = await call(h, 'GET', '/auth/options');
    expect(res.json()).toEqual({ hostSignInUrl: null });
  });
});

describe('GET /books', () => {
  it("shows the author's books with the details the host sends, and account totals", async () => {
    const priya = await h.login(EMAILS.priya);
    const res = await call(h, 'GET', '/books', priya);
    const { items, account } = res.json<BookList>();
    expect(items.map((b) => b.title)).toEqual(['Whispers of the Ganges', 'The Saffron Diaries']);
    expect(items[0]?.details).toContainEqual({ label: 'Royalty pending', display: '₹3,570' });
    expect(account.map((d) => d.label)).toEqual([
      'Royalty earned',
      'Royalty paid',
      'Royalty pending',
    ]);
  });
});

describe('when the host is down', () => {
  it('the assistant gets a "records unavailable" fact instead of guessing', async () => {
    const priya = await h.login(EMAILS.priya);
    const admin = await h.login(EMAILS.admin);
    const settings = await call(h, 'GET', '/admin/assistant', admin);
    const { version } = settings.json<{ settings: { version: number } }>().settings;
    await call(h, 'PUT', '/admin/assistant/settings', admin, { version, chatEnabled: true });
    await h.stopHost();
    h.clock.advance(61_000); // past the 60 s cache
    const chat = (await call(h, 'POST', '/chat/sessions', priya)).json<{ id: string }>();
    const res = await call(h, 'POST', `/chat/sessions/${chat.id}/messages`, priya, {
      body: 'How much royalty is pending on my books?',
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(h.aiCalls.at(-1))).toContain('host.records_unavailable');
  });
});
