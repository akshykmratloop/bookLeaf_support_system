import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/index.js';
import {
  call,
  createHarness,
  deleteWorkspace,
  EMAILS,
  hostTokenFor,
  ORIGIN,
  type Harness,
} from './helpers/app.js';

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

describe("embed mode for a workspace's own origins (EMBED_ENABLED, no HOST_ORIGINS)", () => {
  const OWNER = {
    workspaceName: 'Acme Embeds',
    slug: 'acme-embed',
    ownerName: 'Ada Owner',
    email: 'ada@acme-embed.example',
    password: 'Correct-Horse-42',
  };
  let w: Harness;
  let acme: string;
  const cspOf = async (url: string) =>
    String((await w.app.inject({ method: 'GET', url })).headers['content-security-policy']);
  const save = async (allowedOrigins: string[]) => {
    const { settings } = (await call(w, 'GET', '/workspace/settings', acme)).json<{
      settings: { version: number };
    }>();
    return call(w, 'PUT', '/workspace/settings', acme, {
      version: settings.version,
      allowedOrigins,
    });
  };

  beforeAll(async () => {
    w = await createHarness({ env: { EMBED_ENABLED: 'true' } });
    await call(w, 'POST', '/signup', undefined, OWNER);
    acme = await w.login(OWNER.email, OWNER.password);
  });
  afterAll(async () => {
    await deleteWorkspace(w.db, OWNER.slug);
    await w.close();
  });

  it('lets an origin saved in the settings screen frame the widget page', async () => {
    expect(await cspOf('/embed')).toContain("frame-ancestors 'none'");
    expect((await save(['https://App.Acme.example/dashboard?x=1'])).statusCode).toBe(200);
    expect(await cspOf('/embed')).toContain('frame-ancestors https://app.acme.example');
    expect(await cspOf('/login')).toContain("frame-ancestors 'none'");
  });

  it('refuses anything but a web origin, so no one can add a rule to the header (422)', async () => {
    for (const bad of ['javascript:a; script-src *', 'data:,x;y', 'ftp://files.acme.example']) {
      const res = await save([bad]);
      expect(res.statusCode).toBe(422);
    }
    expect(await cspOf('/embed')).not.toContain('script-src *');
  });
});
