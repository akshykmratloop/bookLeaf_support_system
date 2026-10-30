import type { OnboardingStatus, OnboardingStepId } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  call,
  createHarness,
  createTicket,
  deleteWorkspace,
  ORIGIN,
  type Harness,
} from './helpers/app.js';
import { authorCookieOf, ownerCookie, ownerOf, signupWorkspace } from './helpers/workspaces.js';

const SLUG = 'onboard-acme';
const OTHER = 'onboard-other';
const DOCS = 'https://docs.example.com/integration';

let h: Harness;
let admin: string;
let workspaceId: string;

const status = async (cookie = admin) => {
  const res = await call(h, 'GET', '/workspace/onboarding', cookie);
  expect(res.statusCode).toBe(200);
  return res.json<OnboardingStatus>();
};
const stepOf = async (id: OnboardingStepId, cookie = admin) => {
  const found = (await status(cookie)).steps.find((s) => s.id === id);
  if (!found) throw new Error(`no step ${id}`);
  return found;
};

beforeAll(async () => {
  h = await createHarness({ env: { EMBED_ENABLED: 'true', INTEGRATION_DOCS_URL: DOCS } });
  for (const slug of [SLUG, OTHER]) {
    await deleteWorkspace(h.db, slug);
    await signupWorkspace(h, ownerOf(slug, `Workspace ${slug}`));
  }
  admin = await ownerCookie(h, SLUG);
  workspaceId = (await h.db.workspace.findUniqueOrThrow({ where: { slug: SLUG } })).id;
});
afterAll(async () => {
  for (const slug of [SLUG, OTHER]) await deleteWorkspace(h.db, slug);
  await h.close();
});

describe('GET /workspace/onboarding: the setup guide, checked on the server (U-12)', () => {
  it('refuses strangers (401) and customers (403)', async () => {
    expect((await call(h, 'GET', '/workspace/onboarding')).statusCode).toBe(401);
    const author = await authorCookieOf(h, OTHER);
    expect((await call(h, 'GET', '/workspace/onboarding', author)).statusCode).toBe(403);
  });

  it('a new workspace: its slug, the support and docs URLs, and nothing done yet', async () => {
    const s = await status();
    expect(s.workspace.slug).toBe(SLUG);
    expect(s.supportUrl).toBe(ORIGIN);
    expect(s.docsUrl).toBe(DOCS);
    expect(s.testTicket).toBeNull();
    expect(s.steps).toHaveLength(8);
    expect(s.steps.filter((x) => x.state === 'done')).toEqual([]);
  });

  it('connect + fields: a failed connection test is broken; a passing one ticks both', async () => {
    await h.db.workspaceConnector.create({
      data: {
        workspaceId,
        apiKeyEnc: 'x',
        apiKeyHint: '…1234',
        signingSecretEnc: 'x',
        signingSecretHint: '…5678',
        lastTestAt: new Date(),
        lastTestOk: false,
        lastTestDetail: 'customers: HTTP 401',
      },
    });
    const source = await h.db.workspaceDataSource.create({
      data: { workspaceId, name: 'customers', urlTemplate: 'https://api.acme.example/c/{id}' },
    });
    await h.db.customerField.create({
      data: {
        workspaceId,
        key: 'plan',
        label: 'Plan',
        type: 'TEXT',
        sourceId: source.id,
        path: 'plan',
      },
    });
    expect(await stepOf('connect')).toMatchObject({ state: 'broken' });
    expect((await stepOf('connect')).detail).toContain('HTTP 401');
    expect((await stepOf('fields')).state).toBe('broken');
    await h.db.workspaceConnector.update({ where: { workspaceId }, data: { lastTestOk: true } });
    expect((await stepOf('connect')).state).toBe('done');
    expect((await stepOf('fields')).state).toBe('done');
  });

  it('origins + teach + extras follow what the workspace has saved', async () => {
    expect((await stepOf('teach')).state).toBe('todo');
    await h.db.knowledgeArticle.create({
      data: { workspaceId, title: 'Refunds', body: 'Ten days.' },
    });
    expect((await stepOf('teach')).state).toBe('done');

    const { settings } = (await call(h, 'GET', '/workspace/settings', admin)).json<{
      settings: { version: number };
    }>();
    const allowed = ['https://app.acme.example'];
    await call(h, 'PUT', '/workspace/settings', admin, {
      version: settings.version,
      allowedOrigins: allowed,
    });
    expect(await stepOf('origins')).toMatchObject({ state: 'done' });

    const key = { name: 'Server', scopes: ['tickets:read'] };
    expect((await call(h, 'POST', '/workspace/api-keys', admin, key)).statusCode).toBe(201);
    expect(await stepOf('extras')).toMatchObject({ state: 'done', optional: true });
  });

  it('extras: a webhook delivery that gave up shows as broken', async () => {
    const hook = await h.db.workspaceWebhook.create({
      data: {
        workspaceId,
        url: 'https://hooks.acme.example',
        events: ['ticket.created'],
        secretEnc: 'x',
      },
    });
    await h.db.webhookDelivery.create({
      data: {
        webhookId: hook.id,
        event: 'ticket.created',
        payload: {},
        status: 'FAILED',
        attempts: 5,
        nextAttemptAt: new Date(),
        responseStatus: 500,
      },
    });
    expect(await stepOf('extras')).toMatchObject({ state: 'broken' });
    expect((await stepOf('extras')).detail).toContain('HTTP 500');
    await h.db.workspaceWebhook.delete({ where: { id: hook.id } });
  });
});

describe('POST /workspace/onboarding/test-ticket', () => {
  it('raises a real ticket in this workspace that does not tick "Test it"', async () => {
    const res = await call(h, 'POST', '/workspace/onboarding/test-ticket', admin);
    expect(res.statusCode).toBe(201);
    const sent = res.json<{ id: string; label: string }>();
    const row = await h.db.ticket.findUniqueOrThrow({ where: { id: sent.id } });
    expect(row.workspaceId).toBe(workspaceId);
    expect(row.subject).toContain('Test ticket');
    expect((await h.db.aiJob.count({ where: { ticketId: sent.id } })) > 0).toBe(true);

    const s = await status();
    expect(s.testTicket?.label).toBe(sent.label);
    const test = s.steps.find((x) => x.id === 'test');
    expect(test).toMatchObject({ state: 'todo' });
    expect(test?.detail).toContain(sent.label);
  });

  it('a second test ticket reuses the same test customer', async () => {
    expect((await call(h, 'POST', '/workspace/onboarding/test-ticket', admin)).statusCode).toBe(
      201,
    );
    expect(
      await h.db.author.count({ where: { workspaceId, externalId: 'bookleaf-setup-test' } }),
    ).toBe(1);
  });

  it('refuses customers (403) and strangers (401)', async () => {
    const author = await authorCookieOf(h, SLUG);
    expect((await call(h, 'POST', '/workspace/onboarding/test-ticket', author)).statusCode).toBe(
      403,
    );
    expect((await call(h, 'POST', '/workspace/onboarding/test-ticket')).statusCode).toBe(401);
  });

  it("ticks on the first real customer's ticket, and never on another workspace's", async () => {
    // BookLeaf (another workspace in this database) has many tickets: none count here.
    expect((await stepOf('test')).state).toBe('todo');
    const author = await h.db.user.findFirstOrThrow({
      where: { workspaceId, email: `author@${SLUG}.example` },
    });
    const cookie = await h.container.sessions.sign({
      userId: author.id,
      workspaceId,
      role: 'AUTHOR',
      authorId: (await h.db.author.findUniqueOrThrow({ where: { userId: author.id } })).id,
      name: author.name,
      email: author.email,
    });
    const body = {
      bookId: null,
      subject: 'My plan is wrong',
      description: 'It shows the old plan.',
    };
    expect((await createTicket(h, `bl_session=${cookie}`, body)).statusCode).toBe(201);
    expect(await stepOf('test')).toMatchObject({ state: 'done' });
    expect((await stepOf('test', await ownerCookie(h, OTHER))).state).toBe('todo');
  });
});
