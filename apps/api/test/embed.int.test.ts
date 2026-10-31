import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
const ACME_PAGE = 'https://app.acme-frame.example';
const PAGE = '<!doctype html><title>support</title>';
const ACME = {
  workspaceName: 'Acme Frames',
  slug: 'acme-frame',
  ownerName: 'Ada Owner',
  email: 'ada@acme-frame.example',
  password: 'Correct-Horse-42',
};

/** A stand-in web build, so the API serves the widget page itself (as in production). */
function webBuild(): string {
  const dir = mkdtempSync(join(tmpdir(), 'embed-web-'));
  writeFileSync(join(dir, 'index.html'), PAGE);
  writeFileSync(join(dir, 'embed.js'), '(() => {})();');
  return dir;
}

/** Saves a workspace's allowed origins from its settings screen. */
async function saveOrigins(h: Harness, cookie: string, allowedOrigins: string[]) {
  const { settings } = (await call(h, 'GET', '/workspace/settings', cookie)).json<{
    settings: { version: number };
  }>();
  return call(h, 'PUT', '/workspace/settings', cookie, {
    version: settings.version,
    allowedOrigins,
  });
}

let h: Harness;
let web: string;
const get = (url: string) => h.app.inject({ method: 'GET', url });
const csp = async (url: string) => String((await get(url)).headers['content-security-policy']);

beforeAll(async () => {
  web = webBuild();
  h = await createHarness({
    env: {
      HOST_ORIGINS: `${HOST_PAGE}/, https://app.example.com`,
      WEB_DIST_DIR: web,
      SIGNUPS_PER_HOUR: '10',
      PUBLIC_API_WS_ORIGIN: 'wss://api.example.com',
    },
  });
  await deleteWorkspace(h.db, ACME.slug);
  await call(h, 'POST', '/signup', undefined, ACME);
  const acme = await h.login(ACME.email, ACME.password);
  expect((await saveOrigins(h, acme, [ACME_PAGE])).statusCode).toBe(200);
});
afterAll(async () => {
  await deleteWorkspace(h.db, ACME.slug);
  await h.close();
  rmSync(web, { recursive: true, force: true });
});

describe('one widget address per workspace (/embed/<slug>, F-18)', () => {
  it("serves the widget page with only that workspace's origins in frame-ancestors", async () => {
    const res = await get('/embed/bookleaf');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(PAGE);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['x-frame-options']).toBeUndefined();
    expect(await csp('/embed/bookleaf')).toContain(
      `frame-ancestors ${HOST_PAGE} https://app.example.com;`,
    );
    // In-frame pages of the author app (tickets, history) get the same rule.
    expect(await csp('/embed/bookleaf/tickets/123')).toContain(`frame-ancestors ${HOST_PAGE}`);
  });

  it('lets the BookLeaf origin frame /embed/bookleaf but not another workspace', async () => {
    const acme = await csp(`/embed/${ACME.slug}`);
    expect(acme).toContain(`frame-ancestors ${ACME_PAGE};`);
    expect(acme).not.toContain(HOST_PAGE);
    expect(await csp('/embed/bookleaf')).not.toContain(ACME_PAGE);
    expect(await csp(`/embed/${ACME.slug}/history`)).not.toContain(HOST_PAGE);
  });

  it('answers 404 for a workspace that does not exist', async () => {
    for (const url of ['/embed/no-such-workspace', '/embed/no-such-workspace/tickets']) {
      expect((await get(url)).statusCode).toBe(404);
    }
  });

  it('sends the old /embed address (and its in-app pages) to BookLeaf, keeping the query', async () => {
    const cases: [string, string][] = [
      ['/embed', '/embed/bookleaf'],
      ['/embed?x=1', '/embed/bookleaf?x=1'],
      ['/embed/tickets/123', '/embed/bookleaf/tickets/123'],
      ['/embed/ask', '/embed/bookleaf/ask'],
      ['/embed/history/chat/abc', '/embed/bookleaf/history/chat/abc'],
      // Encoded characters stay encoded: nothing can be smuggled into the Location header.
      ['/embed/tickets/a%0d%0ab', '/embed/bookleaf/tickets/a%0d%0ab'],
    ];
    for (const [from, to] of cases) {
      const res = await get(from);
      expect(res.statusCode, from).toBe(302);
      expect(res.headers.location, from).toBe(to);
    }
  });

  it("lets the page reach the API's own WebSocket address for voice (behind a proxy)", async () => {
    expect(await csp('/embed/bookleaf')).toContain("connect-src 'self' wss://api.example.com");
  });

  it("lets the widget page show the workspace's https logo; other pages keep img-src strict", async () => {
    expect(await csp('/embed/bookleaf')).toContain("img-src 'self' data: https:");
    expect(await csp('/embed/bookleaf/tickets')).toContain("img-src 'self' data: https:");
    for (const url of ['/login', '/admin', '/api/v1/auth/me']) {
      const header = await csp(url);
      expect(header).toContain("img-src 'self' data:;");
      expect(header).not.toContain('https:;');
    }
  });

  it('keeps every other page unframeable', async () => {
    expect(await csp('/login')).toContain("frame-ancestors 'none'");
    expect(await csp('/api/v1/auth/me')).toContain("frame-ancestors 'none'");
    expect(await csp('/embedded-elsewhere')).toContain("frame-ancestors 'none'");
  });

  it('lets host pages load the widget script, and nothing else', async () => {
    const corp = async (url: string) => (await get(url)).headers['cross-origin-resource-policy'];
    expect(await corp('/embed.js')).toBe('cross-origin');
    expect(await corp('/login')).toBe('same-origin');
  });
});

describe('host sign-in inside a workspace widget', () => {
  it("refuses a host token for another workspace than the widget's address (403)", async () => {
    // A token without `iss` belongs to the default workspace (BookLeaf).
    const token = await hostTokenFor(EMAILS.kavita);
    const wrong = await call(h, 'POST', '/auth/host', undefined, { token, workspace: ACME.slug });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.cookies.find((c) => c.name === 'bl_session')).toBeUndefined();
    // The refused try did not use the token up: the right widget can still exchange it.
    const right = await call(h, 'POST', '/auth/host', undefined, { token, workspace: 'bookleaf' });
    expect(right.statusCode).toBe(200);
    expect(right.json<{ workspace: { slug: string } }>().workspace.slug).toBe('bookleaf');
  });

  it("tells a full-page sign-in which workspace's widget to open", async () => {
    const res = await call(h, 'POST', '/auth/host', undefined, {
      token: await hostTokenFor(EMAILS.kavita),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ workspace: { slug: string } }>().workspace.slug).toBe('bookleaf');
  });

  it('issues a partitioned cookie that works inside the iframe', async () => {
    const res = await call(h, 'POST', '/auth/host', undefined, {
      token: await hostTokenFor(EMAILS.kavita),
      workspace: 'bookleaf',
    });
    const cookie = res.cookies.find((c) => c.name === 'bl_session');
    expect(cookie).toMatchObject({ sameSite: 'None', secure: true, httpOnly: true });
    expect(String(res.headers['set-cookie'])).toContain('Partitioned');
  });

  it('still refuses cross-site writes: the Origin check does not rely on SameSite', async () => {
    const logout = (origin: string) =>
      h.app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { origin } });
    expect((await logout(HOST_PAGE)).statusCode).toBe(403);
    expect((await logout(ORIGIN)).statusCode).toBe(204);
  });
});

describe('HOST_ORIGINS setting', () => {
  const base = {
    APP_ORIGIN: ORIGIN,
    DATABASE_URL: 'postgresql://u:p@localhost/db',
    DATABASE_ADMIN_URL: 'postgresql://o:p@localhost/db',
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
    ...ACME,
    workspaceName: 'Acme Embeds',
    slug: 'acme-embed',
    email: 'ada@acme-embed.example',
  };
  const page = `/embed/${OWNER.slug}`;
  let w: Harness;
  let acme: string;
  const cspOf = async (url: string) =>
    String((await w.app.inject({ method: 'GET', url })).headers['content-security-policy']);

  beforeAll(async () => {
    w = await createHarness({ env: { EMBED_ENABLED: 'true', WEB_DIST_DIR: web } });
    await deleteWorkspace(w.db, OWNER.slug);
    await call(w, 'POST', '/signup', undefined, OWNER);
    acme = await w.login(OWNER.email, OWNER.password);
  });
  afterAll(async () => {
    await deleteWorkspace(w.db, OWNER.slug);
    await w.close();
  });

  it("lets an origin saved in the settings screen frame that workspace's widget page", async () => {
    expect(await cspOf(page)).toContain("frame-ancestors 'none'");
    const saved = await saveOrigins(w, acme, ['https://App.Acme.example/dashboard?x=1']);
    expect(saved.statusCode).toBe(200);
    expect(await cspOf(page)).toContain('frame-ancestors https://app.acme.example');
    // Another workspace's setting does not open up BookLeaf's widget page.
    expect(await cspOf('/embed/bookleaf')).toContain("frame-ancestors 'none'");
    expect(await cspOf('/login')).toContain("frame-ancestors 'none'");
  });

  it('refuses anything but a web origin, so no one can add a rule to the header (422)', async () => {
    for (const bad of ['javascript:a; script-src *', 'data:,x;y', 'ftp://files.acme.example']) {
      expect((await saveOrigins(w, acme, [bad])).statusCode).toBe(422);
    }
    expect(await cspOf(page)).not.toContain('script-src *');
  });
});
