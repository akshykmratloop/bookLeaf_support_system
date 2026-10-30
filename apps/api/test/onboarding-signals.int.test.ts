import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import {
  call,
  createHarness,
  deleteWorkspace,
  EMAILS,
  hostTokenFor,
  type Harness,
} from './helpers/app.js';
import { ownerCookie, ownerOf, signupWorkspace } from './helpers/workspaces.js';

/**
 * The two real events the setup guide waits for (U-12): a valid hand-over token from the
 * product, and the widget page framed by one of the workspace's allowed sites.
 */
const SLUG = 'onboard-signals';
const SITE = 'https://app.signals.example';
const HOST_PAGE = 'http://localhost:3200';

let h: Harness;
let web: string;

function webBuild(): string {
  const dir = mkdtempSync(join(tmpdir(), 'onboard-web-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>support</title>');
  return dir;
}

const signals = (where: { slug: string } | { id: string }) =>
  h.db.workspace.findUniqueOrThrow({
    where,
    select: {
      lastHandOverAt: true,
      lastWidgetLoadAt: true,
      lastWidgetOrigin: true,
      updatedAt: true,
    },
  });

const frame = (slug: string, headers: Record<string, string>) =>
  h.app.inject({ method: 'GET', url: `/embed/${slug}`, headers });

beforeAll(async () => {
  web = webBuild();
  h = await createHarness({ env: { HOST_ORIGINS: HOST_PAGE, WEB_DIST_DIR: web } });
  await deleteWorkspace(h.db, SLUG);
  await signupWorkspace(h, ownerOf(SLUG, 'Signals'));
  const admin = await ownerCookie(h, SLUG);
  const { settings } = (await call(h, 'GET', '/workspace/settings', admin)).json<{
    settings: { version: number };
  }>();
  await call(h, 'PUT', '/workspace/settings', admin, {
    version: settings.version,
    allowedOrigins: [SITE],
  });
  await h.db.workspace.update({
    where: { id: DEFAULT_WORKSPACE_ID },
    data: { lastHandOverAt: null, lastWidgetLoadAt: null, lastWidgetOrigin: null },
  });
});
afterAll(async () => {
  await deleteWorkspace(h.db, SLUG);
  await h.close();
  rmSync(web, { recursive: true, force: true });
});

describe('hand-over signal', () => {
  it('a refused token (bad signature) records nothing', async () => {
    const good = await hostTokenFor(EMAILS.priya);
    const token = `${good.slice(0, -4)}${good.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'}`;
    const res = await call(h, 'POST', '/auth/host', undefined, { token });
    expect(res.statusCode).toBe(401);
    expect((await signals({ id: DEFAULT_WORKSPACE_ID })).lastHandOverAt).toBeNull();
  });

  it('a valid hand-over records the time on its own workspace only, once a minute', async () => {
    const before = await signals({ id: DEFAULT_WORKSPACE_ID });
    await h.login(EMAILS.priya);
    const first = await signals({ id: DEFAULT_WORKSPACE_ID });
    expect(first.lastHandOverAt).not.toBeNull();
    // Not an edit of the workspace: its updated_at stays.
    expect(first.updatedAt).toEqual(before.updatedAt);
    expect((await signals({ slug: SLUG })).lastHandOverAt).toBeNull();

    await h.login(EMAILS.rohit);
    expect((await signals({ id: DEFAULT_WORKSPACE_ID })).lastHandOverAt).toEqual(
      first.lastHandOverAt,
    );
    h.clock.advance(61_000);
    const token = await hostTokenFor(EMAILS.arjun);
    expect((await call(h, 'POST', '/auth/host', undefined, { token })).statusCode).toBe(200);
    const later = (await signals({ id: DEFAULT_WORKSPACE_ID })).lastHandOverAt;
    expect(later?.getTime()).toBeGreaterThan(first.lastHandOverAt?.getTime() ?? 0);
  });

  it('shows on the BookLeaf admin setup guide as done', async () => {
    const admin = await h.login(EMAILS.admin);
    const res = await call(h, 'GET', '/workspace/onboarding', admin);
    const step = res
      .json<{ steps: { id: string; state: string }[] }>()
      .steps.find((s) => s.id === 'signIn');
    expect(step?.state).toBe('done');
  });
});

describe('widget-load signal', () => {
  it('ignores a top-level visit, another site and a missing referrer', async () => {
    expect(
      (await frame(SLUG, { referer: `${SITE}/`, 'sec-fetch-dest': 'document' })).statusCode,
    ).toBe(200);
    await frame(SLUG, { referer: 'https://evil.example/', 'sec-fetch-dest': 'iframe' });
    await frame(SLUG, { 'sec-fetch-dest': 'iframe' });
    expect((await signals({ slug: SLUG })).lastWidgetLoadAt).toBeNull();
  });

  it('records the allowed site that framed the page, for that workspace only', async () => {
    const res = await frame(SLUG, { referer: `${SITE}/account`, 'sec-fetch-dest': 'iframe' });
    expect(res.statusCode).toBe(200);
    const s = await signals({ slug: SLUG });
    expect(s.lastWidgetOrigin).toBe(SITE);
    expect(s.lastWidgetLoadAt).not.toBeNull();
    expect((await signals({ id: DEFAULT_WORKSPACE_ID })).lastWidgetLoadAt).toBeNull();

    const admin = await ownerCookie(h, SLUG);
    const guide = (await call(h, 'GET', '/workspace/onboarding', admin)).json<{
      steps: { id: string; state: string; detail: string }[];
    }>();
    expect(guide.steps.find((x) => x.id === 'widget')).toMatchObject({ state: 'done' });
  });

  it("records BookLeaf's env origin (HOST_ORIGINS) on BookLeaf's page", async () => {
    await frame('bookleaf', { referer: `${HOST_PAGE}/`, 'sec-fetch-dest': 'iframe' });
    expect((await signals({ id: DEFAULT_WORKSPACE_ID })).lastWidgetOrigin).toBe(HOST_PAGE);
  });
});
