import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ValidationError } from '../src/platform/errors.js';
import { createWebhookDispatcher, MAX_ATTEMPTS } from '../src/modules/webhooks/dispatcher.js';
import { createWebhookService } from '../src/modules/webhooks/service.js';
import { verifySignature } from '../src/modules/webhooks/signing.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import { bookId, call, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';
import { startReceiver } from './helpers/receiver.js';

let h: Harness;
let admin: string;
let priya: string;
let receiver: Awaited<ReturnType<typeof startReceiver>>;
let secret: string;
let webhookId: string;
let dispatcher: ReturnType<typeof createWebhookDispatcher>;

const silent = { warn: () => undefined, error: () => undefined };
const deliveries = () =>
  h.db.webhookDelivery.findMany({ where: { webhookId }, orderBy: { createdAt: 'asc' } });
const lastBody = (): unknown => JSON.parse(receiver.received.at(-1)?.body ?? '{}');
const newTicket = async () => {
  const res = await createTicket(h, priya, {
    bookId: await bookId(h, 'BK001'),
    subject: 'Royalty payout',
    description: 'My royalty payout has not arrived yet for my book, please check.',
  });
  return res.json<{ id: string }>().id;
};

beforeAll(async () => {
  h = await createHarness();
  receiver = await startReceiver();
  [admin, priya] = await Promise.all([h.login(EMAILS.admin), h.login(EMAILS.priya)]);
  dispatcher = createWebhookDispatcher(
    {
      db: h.db,
      clock: h.clock,
      envelope: h.container.envelope,
      ssrf: { requireHttps: false, allowPrivateHosts: true },
      log: silent,
    },
    { pollMs: 10 },
  );
  const res = await call(h, 'POST', '/workspace/webhooks', admin, {
    url: receiver.url,
    events: ['ticket.created', 'ticket.replied', 'ticket.status_changed'],
  });
  expect(res.statusCode).toBe(201);
  ({ signingSecret: secret } = res.json<{ signingSecret: string }>());
  webhookId = res.json<{ webhook: { id: string } }>().webhook.id;
});
beforeEach(() => receiver.answerWith());
afterAll(async () => {
  await h.db.workspaceWebhook.deleteMany({ where: { workspaceId: DEFAULT_WORKSPACE_ID } });
  await receiver.close();
  await h.close();
});

describe('webhooks: setup', () => {
  it('shows the signing secret once and stores it encrypted', async () => {
    expect(secret).toMatch(/^whsec_/);
    const list = await call(h, 'GET', '/workspace/webhooks', admin);
    expect(JSON.stringify(list.json())).not.toContain(secret);
    const row = await h.db.workspaceWebhook.findUniqueOrThrow({ where: { id: webhookId } });
    expect(row.secretEnc).not.toContain(secret.slice(6, 30));
  });

  it('refuses bad URLs and events (422), internal addresses, authors (403)', async () => {
    const bad = await Promise.all([
      call(h, 'POST', '/workspace/webhooks', admin, {
        url: 'ftp://x.example',
        events: ['ticket.created'],
      }),
      call(h, 'POST', '/workspace/webhooks', admin, { url: receiver.url, events: [] }),
      call(h, 'POST', '/workspace/webhooks', admin, {
        url: receiver.url,
        events: ['ticket.deleted'],
      }),
    ]);
    expect(bad.map((r) => r.statusCode)).toEqual([422, 422, 422]);
    const strict = createWebhookService({
      db: h.db,
      clock: h.clock,
      envelope: h.container.envelope,
      ssrf: { requireHttps: false, allowPrivateHosts: false },
    });
    const session = { workspaceId: DEFAULT_WORKSPACE_ID, userId: 'x' } as never;
    await expect(
      strict.create(session, { url: 'http://127.0.0.1:9/x', events: ['ticket.created'] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await call(h, 'GET', '/workspace/webhooks', priya)).statusCode).toBe(403);
  });
});

describe('webhooks: delivery', () => {
  it('a new ticket is written to the outbox with the ticket and sent signed', async () => {
    const before = (await deliveries()).length;
    const id = await newTicket();
    expect((await deliveries()).length).toBe(before + 1);
    await dispatcher.runOnce();
    const got = receiver.received.at(-1);
    expect(got?.headers['x-bookleaf-event']).toBe('ticket.created');
    const header = String(got?.headers['x-bookleaf-signature']);
    const nowSeconds = Math.floor(h.clock.now().getTime() / 1000);
    expect(verifySignature({ secret, header, body: got?.body ?? '', nowSeconds })).toBe(true);
    expect(
      verifySignature({ secret: 'whsec_wrong', header, body: got?.body ?? '', nowSeconds }),
    ).toBe(false);
    const body = lastBody() as { type: string; data: { ticket: Record<string, unknown> } };
    expect(body.type).toBe('ticket.created');
    expect(body.data.ticket).toMatchObject({ id, customerId: 'AUTH001', itemId: 'BK001' });
    expect(body.data.ticket).not.toHaveProperty('description');
    expect((await deliveries()).at(-1)?.status).toBe('SUCCEEDED');
  });

  it('sends staff replies, never internal notes, and status changes', async () => {
    const id = await newTicket();
    await dispatcher.runOnce();
    await call(h, 'POST', `/tickets/${id}/messages`, admin, {
      body: 'Internal: check with finance.',
      kind: 'INTERNAL_NOTE',
    });
    const note = await deliveries();
    const body =
      'Hi Priya, thank you for your patience. Our team will get back to you within 48 hours. Warm regards, BookLeaf Author Support';
    expect((await call(h, 'POST', `/tickets/${id}/messages`, admin, { body })).statusCode).toBe(
      201,
    );
    const afterReply = await deliveries();
    expect(afterReply.length).toBe(note.length + 1);
    await dispatcher.runOnce();
    expect(lastBody()).toMatchObject({ type: 'ticket.replied', data: { message: { body } } });
    const { version } = (await call(h, 'GET', `/tickets/${id}`, admin)).json<{ version: number }>();
    await call(h, 'PATCH', `/tickets/${id}`, admin, { version, status: 'RESOLVED' });
    await dispatcher.runOnce();
    expect(lastBody()).toMatchObject({
      type: 'ticket.status_changed',
      data: { ticket: { status: 'RESOLVED' } },
    });
  });

  it('retries a failing receiver with backoff, then gives up after the last attempt', async () => {
    receiver.answerWith(...Array.from({ length: MAX_ATTEMPTS }, () => 500));
    await newTicket();
    const target = (await deliveries()).at(-1);
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await dispatcher.runOnce();
      const d = await h.db.webhookDelivery.findUniqueOrThrow({ where: { id: target?.id } });
      expect(d).toMatchObject({ attempts: i + 1, responseStatus: 500, lastError: 'HTTP 500' });
      if (i < MAX_ATTEMPTS - 1) {
        expect(d.status).toBe('PENDING');
        expect(d.nextAttemptAt.getTime()).toBeGreaterThan(h.clock.now().getTime());
        h.clock.advance(20 * 60_000);
      } else expect(d.status).toBe('FAILED');
    }
  });

  it('queues a signed test delivery on request (202)', async () => {
    const res = await call(h, 'POST', `/workspace/webhooks/${webhookId}/test`, admin);
    expect(res.statusCode).toBe(202);
    await dispatcher.runOnce();
    expect(lastBody()).toMatchObject({ type: 'webhook.test' });
    const recent = await call(h, 'GET', `/workspace/webhooks/${webhookId}/deliveries`, admin);
    expect(recent.json<{ items: { event: string }[] }>().items[0]?.event).toBe('webhook.test');
  });
});
