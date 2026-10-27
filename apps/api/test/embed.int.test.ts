import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/index.js';
import { call, createHarness, EMAILS, hostTokenFor, ORIGIN, type Harness } from './helpers/app.js';

const HOST_PAGE = 'http://localhost:3200';
let h: Harness;

beforeAll(async () => {
  h = await createHarness({ env: { HOST_ORIGINS: `${HOST_PAGE}/, https://app.example.com` } });
});
afterAll(() => h.close());

const csp = async (url: string) =>
  String((await h.app.inject({ method: 'GET', url })).headers['content-security-policy']);

describe('embed mode (HOST_ORIGINS set)', () => {
  it('lets only the configured host origins frame the widget page', async () => {
    expect(await csp('/embed')).toContain(`frame-ancestors ${HOST_PAGE} https://app.example.com`);
    // In-frame pages of the author app (tickets, history) may be framed too.
    expect(await csp('/embed/tickets/123')).toContain(`frame-ancestors ${HOST_PAGE}`);
    const res = await h.app.inject({ method: 'GET', url: '/embed' });
    expect(res.headers['x-frame-options']).toBeUndefined();
  });

  it('keeps every other page unframeable', async () => {
    expect(await csp('/login')).toContain("frame-ancestors 'none'");
    expect(await csp('/api/v1/auth/me')).toContain("frame-ancestors 'none'");
    expect(await csp('/embedded-elsewhere')).toContain("frame-ancestors 'none'");
  });

  it('lets host pages load the widget script, and nothing else', async () => {
    const corp = async (url: string) =>
      (await h.app.inject({ method: 'GET', url })).headers['cross-origin-resource-policy'];
    expect(await corp('/embed.js')).toBe('cross-origin');
    expect(await corp('/login')).toBe('same-origin');
  });

  it('issues a partitioned cookie that works inside the iframe', async () => {
    const res = await call(h, 'POST', '/auth/host', undefined, {
      token: await hostTokenFor(EMAILS.kavita),
    });
    const cookie = res.cookies.find((c) => c.name === 'bl_session');
    expect(cookie).toMatchObject({ sameSite: 'None', secure: true, httpOnly: true });
    expect(String(res.headers['set-cookie'])).toContain('Partitioned');
  });

  it('still refuses cross-site writes: the Origin check does not rely on SameSite', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { origin: HOST_PAGE },
    });
    expect(res.statusCode).toBe(403);
    const own = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { origin: ORIGIN },
    });
    expect(own.statusCode).toBe(204);
  });
});

describe('HOST_ORIGINS setting', () => {
  const base = {
    APP_ORIGIN: ORIGIN,
    DATABASE_URL: 'postgresql://u:p@localhost/db',
    JWT_SECRET: 'x'.repeat(32),
    HOST_API_URL: HOST_PAGE,
    HOST_API_KEY: 'k'.repeat(24),
    HOST_SIGNING_SECRET: 's'.repeat(32),
  };

  it('is off by default and rejects anything that is not a URL', () => {
    expect(loadEnv(base).HOST_ORIGINS).toEqual([]);
    expect(() => loadEnv({ ...base, HOST_ORIGINS: 'not a url' })).toThrow(/HOST_ORIGINS/);
  });
});
