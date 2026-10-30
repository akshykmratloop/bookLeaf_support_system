import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import { call, createHarness, deleteWorkspace, EMAILS, type Harness } from './helpers/app.js';
import { startReceiver } from './helpers/receiver.js';
import { asServer, mintKey, SERVER_TICKET } from './helpers/server-api.js';

let h: Harness;
let writeKey: string;
let readKey: string;
let acmeKey: string;
let receiver: Awaited<ReturnType<typeof startReceiver>>;

const OWNER = {
  workspaceName: 'Acme Server Writes',
  slug: 'acme-server-writes',
  ownerName: 'Ada Owner',
  email: 'ada@acme-server-writes.example',
  password: 'Correct-Horse-42',
};

interface Detail {
  id: string;
  number: string;
  customerId: string;
  itemId: string | null;
  status: string;
  messages: { kind: string; body: string }[];
}

const create = (body: object, opts: { key?: string; idem?: string | true } = {}) =>
  asServer(h, 'POST', '/server/tickets', { key: writeKey, body, ...opts });

beforeAll(async () => {
  h = await createHarness();
  receiver = await startReceiver();
  await call(h, 'POST', '/signup', undefined, OWNER);
  const [admin, acme] = await Promise.all([
    h.login(EMAILS.admin),
    h.login(OWNER.email, OWNER.password),
  ]);
  writeKey = (await mintKey(h, admin, ['tickets:read', 'customers:read', 'tickets:write']))
    .plainKey;
  readKey = (await mintKey(h, admin, ['tickets:read', 'customers:read'])).plainKey;
  acmeKey = (await mintKey(h, acme, ['tickets:read', 'customers:read', 'tickets:write'])).plainKey;
  const hook = await call(h, 'POST', '/workspace/webhooks', admin, {
    url: receiver.url,
    events: ['ticket.created'],
  });
  expect(hook.statusCode).toBe(201);
});
afterAll(async () => {
  await h.db.workspaceWebhook.deleteMany({ where: { workspaceId: DEFAULT_WORKSPACE_ID } });
  await deleteWorkspace(h.db, OWNER.slug);
  await receiver.close();
  await h.close();
});

describe('server API: create a ticket (tickets:write)', () => {
  it('raises a ticket for the customer, runs triage and fires ticket.created', async () => {
    const res = await create({ ...SERVER_TICKET, itemId: 'BK001' }, { idem: true });
    expect(res.statusCode).toBe(201);
    const t = res.json<Detail>();
    expect(t).toMatchObject({ customerId: 'AUTH001', itemId: 'BK001', status: 'OPEN' });
    expect(t.number).toMatch(/^BL-\d+$/);
    expect(t.messages.map((m) => m.kind)).toEqual(['SYSTEM']);
    const row = await h.db.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(row).toMatchObject({ source: 'API', description: SERVER_TICKET.body });
    const jobs = await h.db.aiJob.findMany({ where: { ticketId: t.id } });
    expect(jobs.map((j) => j.kind)).toEqual(['TRIAGE']);
    const hooks = await h.db.webhookDelivery.findMany({ where: { event: 'ticket.created' } });
    expect(hooks.some((d) => JSON.stringify(d.payload).includes(t.id))).toBe(true);
  });

  it('returns the first ticket again for a repeated Idempotency-Key (200, no duplicate)', async () => {
    const idem = randomUUID();
    const first = await create(SERVER_TICKET, { idem });
    const again = await create(SERVER_TICKET, { idem });
    expect([first.statusCode, again.statusCode]).toEqual([201, 200]);
    expect(again.json<Detail>().id).toBe(first.json<Detail>().id);
    expect(await h.db.ticket.count({ where: { clientRequestId: idem } })).toBe(1);
  });

  it('refuses the same Idempotency-Key for a different customer (409)', async () => {
    const idem = randomUUID();
    expect((await create(SERVER_TICKET, { idem })).statusCode).toBe(201);
    const other = await create({ ...SERVER_TICKET, customerId: 'AUTH002' }, { idem });
    expect(other.statusCode).toBe(409);
    expect(other.json<{ code: string }>().code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('accepts an account-level ticket without an item', async () => {
    const res = await create({ ...SERVER_TICKET, customerId: 'AUTH002' });
    expect(res.statusCode).toBe(201);
    expect(res.json<Detail>()).toMatchObject({ customerId: 'AUTH002', itemId: null });
  });

  it("404s an unknown customer and another customer's item", async () => {
    const unknown = await create({ ...SERVER_TICKET, customerId: 'AUTH999' });
    expect(unknown.statusCode).toBe(404);
    const notTheirs = await create({ ...SERVER_TICKET, itemId: 'BK003' });
    expect(notTheirs.statusCode).toBe(404);
  });

  it("never reaches another workspace's customers with that workspace's key", async () => {
    const res = await create(SERVER_TICKET, { key: acmeKey });
    expect(res.statusCode).toBe(503);
    expect(await h.db.ticket.count({ where: { workspace: { slug: OWNER.slug } } })).toBe(0);
  });

  it('refuses no key (401) and a key without tickets:write (403)', async () => {
    const none = await asServer(h, 'POST', '/server/tickets', { body: SERVER_TICKET });
    expect(none.statusCode).toBe(401);
    const read = await create(SERVER_TICKET, { key: readKey });
    expect(read.statusCode).toBe(403);
    expect(read.json<{ code: string }>().code).toBe('API_KEY_SCOPE');
  });

  it('validates the body and the Idempotency-Key (422)', async () => {
    expect((await create({ ...SERVER_TICKET, subject: 'Hi' })).statusCode).toBe(422);
    expect((await create({ ...SERVER_TICKET, customerId: '../x' })).statusCode).toBe(422);
    expect((await create(SERVER_TICKET, { idem: 'not-a-uuid' })).statusCode).toBe(422);
  });
});
