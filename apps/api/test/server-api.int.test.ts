import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bookId,
  call,
  createHarness,
  createTicket,
  deleteWorkspace,
  EMAILS,
  type Harness,
} from './helpers/app.js';

let h: Harness;
let admin: string;
let acme: string;
let readKey: string;
let ticketId: string;
let newestId: string;

const OWNER = {
  workspaceName: 'Acme Server API',
  slug: 'acme-server-api',
  ownerName: 'Ada Owner',
  email: 'ada@acme-server.example',
  password: 'Correct-Horse-42',
};

const mintKey = async (cookie: string, scopes: string[]) => {
  const res = await call(h, 'POST', '/workspace/api-keys', cookie, { name: 'Server', scopes });
  expect(res.statusCode).toBe(201);
  return res.json<{ plainKey: string; key: { id: string } }>();
};
const asServer = (url: string, key?: string) =>
  h.app.inject({
    method: 'GET',
    url: `/api/v1${url}`,
    headers: key ? { authorization: `Bearer ${key}` } : {},
  });

beforeAll(async () => {
  h = await createHarness();
  await call(h, 'POST', '/signup', undefined, OWNER);
  [admin, acme] = await Promise.all([h.login(EMAILS.admin), h.login(OWNER.email, OWNER.password)]);
  readKey = (await mintKey(admin, ['tickets:read'])).plainKey;
  const priya = await h.login(EMAILS.priya);
  const res = await createTicket(h, priya, {
    bookId: await bookId(h, 'BK001'),
    subject: 'Server API check',
    description: 'A ticket the server API should list for BookLeaf only.',
  });
  ticketId = res.json<{ id: string }>().id;
  h.clock.advance(1000);
  const newer = await createTicket(h, priya, {
    bookId: null,
    subject: 'Server API newer',
    description: 'The newest ticket, so the cursor test has two pages.',
  });
  newestId = newer.json<{ id: string }>().id;
  await call(h, 'POST', `/tickets/${ticketId}/messages`, admin, {
    body: 'Internal: do not expose this.',
    kind: 'INTERNAL_NOTE',
  });
});
afterAll(async () => {
  await deleteWorkspace(h.db, OWNER.slug);
  await h.close();
});

describe('server API (workspace API keys)', () => {
  it("lists the key's own workspace tickets in host ids, newest first, with a cursor", async () => {
    const all = await asServer('/server/tickets?limit=200', readKey);
    expect(all.statusCode).toBe(200);
    const items = all.json<{ items: { id: string; customerId: string; itemId: string | null }[] }>()
      .items;
    const ids = items.map((t) => t.id);
    expect(ids.indexOf(newestId)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(newestId)).toBeLessThan(ids.indexOf(ticketId));
    expect(items.find((t) => t.id === ticketId)).toMatchObject({
      customerId: 'AUTH001',
      itemId: 'BK001',
    });
    const first = await asServer('/server/tickets?limit=1', readKey);
    const page = first.json<{ items: { id: string }[]; nextCursor: string }>();
    expect(page.items.map((t) => t.id)).toEqual([ids[0]]);
    const next = await asServer(`/server/tickets?limit=1&cursor=${page.nextCursor}`, readKey);
    expect(next.json<{ items: { id: string }[] }>().items.map((t) => t.id)).toEqual([ids[1]]);
  });

  it('returns one ticket with its conversation, never internal notes', async () => {
    const res = await asServer(`/server/tickets/${ticketId}`, readKey);
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('do not expose');
    expect(res.json<{ messages: { kind: string }[] }>().messages.map((m) => m.kind)).not.toContain(
      'INTERNAL_NOTE',
    );
  });

  it("never shows one workspace's tickets to another workspace's key (404 / empty)", async () => {
    const acmeKey = (await mintKey(acme, ['tickets:read'])).plainKey;
    expect((await asServer(`/server/tickets/${ticketId}`, acmeKey)).statusCode).toBe(404);
    const list = await asServer('/server/tickets', acmeKey);
    expect(list.json<{ items: unknown[] }>().items).toEqual([]);
  });

  it('refuses no key or a bad key (401), a missing scope (403), a revoked key (401)', async () => {
    expect((await asServer('/server/tickets')).statusCode).toBe(401);
    expect((await asServer('/server/tickets', 'blsk_nope_nope')).statusCode).toBe(401);
    const narrow = await mintKey(admin, ['customers:read']);
    const scoped = await asServer('/server/tickets', narrow.plainKey);
    expect(scoped.statusCode).toBe(403);
    expect(scoped.json<{ code: string }>().code).toBe('API_KEY_SCOPE');
    await call(h, 'DELETE', `/workspace/api-keys/${narrow.key.id}`, admin);
    expect((await asServer('/server/tickets', narrow.plainKey)).statusCode).toBe(401);
  });

  it('validates the query: limit 1..200, a uuid cursor (422)', async () => {
    expect((await asServer('/server/tickets?limit=201', readKey)).statusCode).toBe(422);
    expect((await asServer('/server/tickets?cursor=nope', readKey)).statusCode).toBe(422);
    expect((await asServer('/server/tickets?limit=200', readKey)).statusCode).toBe(200);
  });
});
