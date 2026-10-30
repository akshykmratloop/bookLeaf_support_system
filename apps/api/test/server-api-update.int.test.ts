import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SERVER_WRITES_PER_MINUTE } from '../src/modules/server-api/limits.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import { call, createHarness, deleteWorkspace, EMAILS, type Harness } from './helpers/app.js';
import { startReceiver } from './helpers/receiver.js';
import { asServer, mintKey, SERVER_TICKET } from './helpers/server-api.js';

let h: Harness;
let writeKey: string;
let readOnly: string;
let acmeKey: string;
let ticketId: string;
let receiver: Awaited<ReturnType<typeof startReceiver>>;

const OWNER = {
  workspaceName: 'Acme Server Updates',
  slug: 'acme-server-updates',
  ownerName: 'Ada Owner',
  email: 'ada@acme-server-updates.example',
  password: 'Correct-Horse-42',
};

interface Detail {
  id: string;
  status: string;
  customerId: string;
  messages: { kind: string; body: string }[];
}

const patch = (status: string, opts: { key?: string; idem?: string } = {}) =>
  asServer(h, 'PATCH', `/server/tickets/${ticketId}`, {
    key: writeKey,
    body: { status },
    ...opts,
  });
const message = (body: string, opts: { key?: string; idem?: string } = {}) =>
  asServer(h, 'POST', `/server/tickets/${ticketId}/messages`, {
    key: writeKey,
    body: { body },
    ...opts,
  });
const statusEvents = () =>
  h.db.webhookDelivery.count({
    where: {
      event: 'ticket.status_changed',
      payload: { path: ['ticket', 'id'], equals: ticketId },
    },
  });

beforeAll(async () => {
  h = await createHarness();
  receiver = await startReceiver();
  await call(h, 'POST', '/signup', undefined, OWNER);
  const [admin, acme] = await Promise.all([
    h.login(EMAILS.admin),
    h.login(OWNER.email, OWNER.password),
  ]);
  const all = ['tickets:read', 'customers:read', 'tickets:write'];
  writeKey = (await mintKey(h, admin, all)).plainKey;
  readOnly = (await mintKey(h, admin, ['tickets:read'])).plainKey;
  acmeKey = (await mintKey(h, acme, all)).plainKey;
  await call(h, 'POST', '/workspace/webhooks', admin, {
    url: receiver.url,
    events: ['ticket.status_changed'],
  });
  const res = await asServer(h, 'POST', '/server/tickets', { key: writeKey, body: SERVER_TICKET });
  ticketId = res.json<Detail>().id;
});
afterAll(async () => {
  await h.db.workspaceWebhook.deleteMany({ where: { workspaceId: DEFAULT_WORKSPACE_ID } });
  await deleteWorkspace(h.db, OWNER.slug);
  await receiver.close();
  await h.close();
});

describe('server API: customer messages (tickets:write)', () => {
  it('adds a message from the customer; a repeated Idempotency-Key adds it once', async () => {
    const idem = randomUUID();
    const first = await message('Here is my statement number: 42.', { idem });
    expect(first.statusCode).toBe(201);
    await message('Here is my statement number: 42.', { idem });
    const authored = await h.db.ticketMessage.count({
      where: { ticketId, kind: 'AUTHOR', clientRequestId: idem },
    });
    expect(authored).toBe(1);
    expect(first.json<Detail>().messages.at(-1)).toMatchObject({ kind: 'AUTHOR' });
  });

  it("404s another workspace's ticket and 403s a key without tickets:write", async () => {
    expect((await message('Hello', { key: acmeKey })).statusCode).toBe(404);
    expect((await message('Hello', { key: readOnly })).statusCode).toBe(403);
    expect((await message('   ')).statusCode).toBe(422);
  });
});

describe('server API: resolve, close, reopen (tickets:write)', () => {
  it('resolves through the ticket status rules and fires ticket.status_changed', async () => {
    const before = await statusEvents();
    const res = await patch('RESOLVED', { idem: randomUUID() });
    expect(res.statusCode).toBe(200);
    expect(res.json<Detail>().status).toBe('RESOLVED');
    expect(await statusEvents()).toBe(before + 1);
    const audit = await h.db.auditEvent.findFirst({
      where: { entityId: ticketId, action: 'ticket.status_set_by_api' },
    });
    expect(audit?.after).toMatchObject({ status: 'RESOLVED' });
  });

  it('a repeated Idempotency-Key does not apply the change again', async () => {
    const idem = randomUUID();
    expect((await patch('OPEN', { idem })).statusCode).toBe(200);
    expect((await patch('CLOSED')).statusCode).toBe(200);
    const replay = await patch('OPEN', { idem });
    expect(replay.statusCode).toBe(200);
    expect(replay.json<Detail>().status).toBe('CLOSED');
  });

  it('refuses a move the status rules do not allow (409) and accepts a no-op', async () => {
    const res = await patch('RESOLVED');
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('INVALID_TRANSITION');
    expect((await patch('CLOSED')).json<Detail>().status).toBe('CLOSED');
    expect((await patch('OPEN')).json<Detail>().status).toBe('OPEN');
  });

  it("404s another workspace's ticket, 403s a read key, 422s an unknown status", async () => {
    expect((await patch('RESOLVED', { key: acmeKey })).statusCode).toBe(404);
    expect((await patch('RESOLVED', { key: readOnly })).statusCode).toBe(403);
    expect((await patch('IN_PROGRESS')).statusCode).toBe(422);
  });
});

describe('server API: one customer’s tickets (customers:read)', () => {
  const list = (id: string, key = writeKey) =>
    asServer(h, 'GET', `/server/customers/${id}/tickets?limit=200`, { key });

  it("lists only that customer's tickets", async () => {
    const res = await list('AUTH001');
    expect(res.statusCode).toBe(200);
    const items = res.json<{ items: { id: string; customerId: string }[] }>().items;
    expect(items.map((t) => t.id)).toContain(ticketId);
    expect(new Set(items.map((t) => t.customerId))).toEqual(new Set(['AUTH001']));
  });

  it('403s a key without customers:read; 404s unknown and other-workspace customers', async () => {
    expect((await list('AUTH001', readOnly)).statusCode).toBe(403);
    expect((await list('AUTH999')).statusCode).toBe(404);
    expect((await list('AUTH001', acmeKey)).statusCode).toBe(404);
    expect((await list('bad%20id')).statusCode).toBe(422);
  });
});

describe('server API: write rate limit', () => {
  // Earlier writes in this file count toward the same minute, so only the edges are fixed.
  it(`allows up to ${SERVER_WRITES_PER_MINUTE} writes a minute, then answers 429`, async () => {
    const codes: number[] = [];
    for (let i = 0; i <= SERVER_WRITES_PER_MINUTE; i += 1)
      codes.push((await patch('BOGUS', { key: readOnly })).statusCode);
    expect(codes[0]).toBe(422);
    expect(codes.at(-1)).toBe(429);
  });
});
