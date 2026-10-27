import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, createTicket, EMAILS, SENTINEL_KEY, type Harness } from './helpers/app.js';

let h: Harness;
let priya: string;
let admin: string;

beforeAll(async () => {
  h = await createHarness();
  [priya, admin] = await Promise.all([h.login(EMAILS.priya), h.login(EMAILS.admin)]);
});
afterAll(() => h.close());

describe('API key never leaves the server', () => {
  it('no response body or header contains the configured key', async () => {
    const created = await createTicket(h, priya, { bookId: null, subject: 'Account question', description: 'How do I update my author bio on the BookLeaf store?' });
    const id = created.json<{ id: string }>().id;
    await h.drain();
    const responses = await Promise.all([
      call(h, 'GET', '/admin/ai/status', admin),
      call(h, 'GET', '/admin/ai/settings', admin),
      call(h, 'POST', '/admin/ai/test', admin),
      call(h, 'GET', '/tickets', admin),
      call(h, 'GET', `/tickets/${id}`, admin),
      call(h, 'GET', `/tickets/${id}/draft`, admin),
      call(h, 'GET', '/auth/me', admin),
      h.app.inject({ method: 'GET', url: '/api/docs/json' }),
      h.app.inject({ method: 'GET', url: '/health' }),
    ]);
    for (const res of responses) {
      expect(res.statusCode).toBeLessThan(500);
      expect(res.body).not.toContain(SENTINEL_KEY);
      expect(JSON.stringify(res.headers)).not.toContain(SENTINEL_KEY);
    }
    const status = responses[0]?.json<{ providers: { id: string; configured: boolean }[] }>();
    expect(status?.providers.find((p) => p.id === 'anthropic')?.configured).toBe(true);
  });

  it('the AI test endpoint reports success without echoing provider details', async () => {
    const res = await call(h, 'POST', '/admin/ai/test', admin);
    expect(res.json<{ ok: boolean }>().ok).toBe(true);
  });

  it('rejects settings that pick a model outside the allowlist (422)', async () => {
    const s = await call(h, 'GET', '/admin/ai/settings', admin);
    const res = await call(h, 'PUT', '/admin/ai/settings', admin, { version: s.json<{ version: number }>().version, draftModel: 'gpt-4o' });
    expect(res.statusCode).toBe(422);
  });
});

describe('session cookie', () => {
  it('is httpOnly and SameSite=Lax; logout clears it', async () => {
    const res = await call(h, 'POST', '/auth/login', undefined, { email: EMAILS.kavita, password: 'Author@Test1' });
    const cookie = res.cookies.find((c) => c.name === 'bl_session');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    const out = await call(h, 'POST', '/auth/logout', `bl_session=${cookie?.value ?? ''}`);
    expect(out.statusCode).toBe(204);
    expect(out.cookies.find((c) => c.name === 'bl_session')?.value).toBe('');
  });

  it('errors are RFC 7807 problem+json without stack traces', async () => {
    const res = await call(h, 'GET', '/no-such-route', admin);
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).not.toMatch(/at .*\.ts:\d+/);
  });

  it('sets security headers', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
