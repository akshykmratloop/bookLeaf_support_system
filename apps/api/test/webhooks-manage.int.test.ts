import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ValidationError } from '../src/platform/errors.js';
import { createWebhookDispatcher, MAX_ATTEMPTS } from '../src/modules/webhooks/dispatcher.js';
import { createWebhookService } from '../src/modules/webhooks/service.js';
import { verifySignature } from '../src/modules/webhooks/signing.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import {
  bookId,
  call,
  createHarness,
  createTicket,
  deleteWorkspace,
  EMAILS,
  type Harness,
} from './helpers/app.js';
import { startReceiver } from './helpers/receiver.js';

interface Delivery {
  id: string;
  status: string;
  attempts: number;
  nextAttemptAt: string | null;
}

let h: Harness;
let admin: string;
let priya: string;
let stranger: string;
let receiver: Awaited<ReturnType<typeof startReceiver>>;
let hookId: string;
let dispatcher: ReturnType<typeof createWebhookDispatcher>;

const OTHER = {
  workspaceName: 'Acme Hooks',
  slug: 'acme-hooks',
  ownerName: 'Hana Owner',
  email: 'hana@acme-hooks.example',
  password: 'Correct-Horse-42',
};
const base = () => `/workspace/webhooks/${hookId}`;
const mine = () => h.db.webhookDelivery.findMany({ where: { webhookId: hookId } });
const audits = (action: string) => h.db.auditEvent.count({ where: { entityId: hookId, action } });
const newTicket = () =>
  bookId(h, 'BK001').then((id) =>
    createTicket(h, priya, {
      bookId: id,
      subject: 'Royalty payout',
      description: 'My royalty payout has not arrived yet for my book, please check.',
    }),
  );

beforeAll(async () => {
  h = await createHarness();
  receiver = await startReceiver();
  [admin, priya] = await Promise.all([h.login(EMAILS.admin), h.login(EMAILS.priya)]);
  await call(h, 'POST', '/signup', undefined, OTHER);
  stranger = await h.login(OTHER.email, OTHER.password);
  dispatcher = createWebhookDispatcher(
    {
      db: h.db,
      clock: h.clock,
      envelope: h.container.envelope,
      ssrf: { requireHttps: false, allowPrivateHosts: true },
      log: { warn: () => undefined, error: () => undefined },
    },
    { pollMs: 10 },
  );
  const res = await call(h, 'POST', '/workspace/webhooks', admin, {
    url: receiver.url,
    events: ['ticket.created'],
  });
  hookId = res.json<{ webhook: { id: string } }>().webhook.id;
});
beforeEach(() => receiver.answerWith());
afterAll(async () => {
  await h.db.workspaceWebhook.deleteMany({ where: { id: hookId } });
  await deleteWorkspace(h.db, OTHER.slug);
  await receiver.close();
  await h.close();
});

describe('webhooks: edit', () => {
  it('changes the address and events, and records it in the audit log', async () => {
    const url = `${receiver.url}?v=2`;
    const res = await call(h, 'PATCH', base(), admin, {
      url,
      events: ['ticket.created', 'ticket.replied'],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ url, events: ['ticket.created', 'ticket.replied'] });
    expect(await audits('webhook.updated')).toBe(1);
  });

  it('refuses empty or bad changes (422), unsafe addresses, authors (403), strangers (401)', async () => {
    const bad = await Promise.all([
      call(h, 'PATCH', base(), admin, {}),
      call(h, 'PATCH', base(), admin, { url: 'ftp://x.example' }),
      call(h, 'PATCH', base(), admin, { events: [] }),
      call(h, 'PATCH', base(), admin, { active: 'yes' }),
    ]);
    expect(bad.map((r) => r.statusCode)).toEqual([422, 422, 422, 422]);
    const strict = createWebhookService({
      db: h.db,
      clock: h.clock,
      envelope: h.container.envelope,
      ssrf: { requireHttps: false, allowPrivateHosts: false },
    });
    const session = { workspaceId: DEFAULT_WORKSPACE_ID, userId: 'x' } as never;
    await expect(
      strict.update(session, hookId, { url: 'http://127.0.0.1:9/x' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await call(h, 'PATCH', base(), priya, { active: false })).statusCode).toBe(403);
    expect((await call(h, 'PATCH', base(), undefined, { active: false })).statusCode).toBe(401);
  });
});

describe('webhooks: on and off', () => {
  it('a switched-off webhook queues nothing, pauses waiting deliveries and refuses a test', async () => {
    await newTicket();
    const queued = (await mine()).length;
    const off = await call(h, 'PATCH', base(), admin, { active: false });
    expect(off.json()).toMatchObject({ active: false });
    await newTicket();
    expect((await mine()).length).toBe(queued);
    const sent = receiver.received.length;
    await dispatcher.runOnce();
    expect(receiver.received.length).toBe(sent);
    expect((await mine()).filter((d) => d.status === 'PENDING')).toHaveLength(1);
    const test = await call(h, 'POST', `${base()}/test`, admin);
    expect(test.statusCode).toBe(409);
    await call(h, 'PATCH', base(), admin, { active: true });
    await dispatcher.runOnce();
    expect(receiver.received.length).toBe(sent + 1);
  });
});

describe('webhooks: rotate the signing secret', () => {
  it('returns a new secret once; deliveries are signed with it, not the old one', async () => {
    const first = await call(h, 'POST', `${base()}/rotate-secret`, admin);
    const second = await call(h, 'POST', `${base()}/rotate-secret`, admin);
    expect(second.statusCode).toBe(200);
    const old = first.json<{ signingSecret: string }>().signingSecret;
    const secret = second.json<{ signingSecret: string }>().signingSecret;
    expect(secret).toMatch(/^whsec_/);
    expect(secret).not.toBe(old);
    const list = await call(h, 'GET', '/workspace/webhooks', admin);
    expect(JSON.stringify(list.json())).not.toContain(secret);
    await call(h, 'POST', `${base()}/test`, admin);
    await dispatcher.runOnce();
    const got = receiver.received.at(-1);
    const sig = {
      header: String(got?.headers['x-bookleaf-signature']),
      body: got?.body ?? '',
      nowSeconds: Math.floor(h.clock.now().getTime() / 1000),
    };
    expect(verifySignature({ secret, ...sig })).toBe(true);
    expect(verifySignature({ secret: old, ...sig })).toBe(false);
    expect(await audits('webhook.secret_rotated')).toBe(2);
  });
});

describe('webhooks: retry a failed delivery', () => {
  it('shows the next retry time, and sends a failed delivery again on request', async () => {
    receiver.answerWith(...Array.from({ length: MAX_ATTEMPTS }, () => 500));
    const queued = (await call(h, 'POST', `${base()}/test`, admin)).json<Delivery>();
    await dispatcher.runOnce();
    const log = await call(h, 'GET', `${base()}/deliveries`, admin);
    const pending = log.json<{ items: Delivery[] }>().items.find((d) => d.id === queued.id);
    expect(pending).toMatchObject({ status: 'PENDING', attempts: 1 });
    expect(pending?.nextAttemptAt).toEqual(expect.any(String));
    const early = await call(h, 'POST', `${base()}/deliveries/${queued.id}/retry`, admin);
    expect(early.statusCode).toBe(409);
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      h.clock.advance(20 * 60_000);
      await dispatcher.runOnce();
    }
    const failed = await h.db.webhookDelivery.findUniqueOrThrow({ where: { id: queued.id } });
    expect(failed.status).toBe('FAILED');
    const retry = await call(h, 'POST', `${base()}/deliveries/${queued.id}/retry`, admin);
    expect(retry.statusCode).toBe(202);
    expect(retry.json()).toMatchObject({ status: 'PENDING', attempts: 0 });
    await dispatcher.runOnce();
    const done = await h.db.webhookDelivery.findUniqueOrThrow({ where: { id: queued.id } });
    expect(done).toMatchObject({ status: 'SUCCEEDED', nextAttemptAt: expect.any(Date) });
    expect(await audits('webhook.delivery_retried')).toBe(1);
  });
});

describe('webhooks: other workspaces', () => {
  it("another workspace's admin gets 404 on every action", async () => {
    const [d] = await mine();
    const codes = await Promise.all([
      call(h, 'PATCH', base(), stranger, { active: false }),
      call(h, 'POST', `${base()}/rotate-secret`, stranger),
      call(h, 'POST', `${base()}/test`, stranger),
      call(h, 'GET', `${base()}/deliveries`, stranger),
      call(h, 'POST', `${base()}/deliveries/${d?.id ?? ''}/retry`, stranger),
      call(h, 'DELETE', base(), stranger),
    ]);
    expect(codes.map((r) => r.statusCode)).toEqual([404, 404, 404, 404, 404, 404]);
    const own = await call(h, 'GET', '/workspace/webhooks', stranger);
    expect(own.json()).toEqual({ items: [] });
    const row = await h.db.workspaceWebhook.findUniqueOrThrow({ where: { id: hookId } });
    expect(row.active).toBe(true);
  });

  it('a delivery id from another webhook is not found (404)', async () => {
    const other = await call(h, 'POST', '/workspace/webhooks', admin, {
      url: receiver.url,
      events: ['ticket.created'],
    });
    const otherId = other.json<{ webhook: { id: string } }>().webhook.id;
    const [d] = await mine();
    const res = await call(
      h,
      'POST',
      `/workspace/webhooks/${otherId}/deliveries/${d?.id}/retry`,
      admin,
    );
    expect(res.statusCode).toBe(404);
    await h.db.workspaceWebhook.delete({ where: { id: otherId } });
  });
});
