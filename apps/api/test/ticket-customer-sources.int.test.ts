import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthorTicket, TicketCustomer } from '@bookleaf/shared';
import {
  call,
  createHarness,
  createTicket,
  deleteWorkspace,
  HOST,
  type Harness,
} from './helpers/app.js';
import { authorCookieOf, ownerCookie, ownerOf, signupWorkspace } from './helpers/workspaces.js';

/**
 * U-1 + U-9: the staff Customer panel shows the one customer record merged from the workspace's
 * data sources: name and email from one source, the items from another, a field from a third.
 * When one source fails, only its line reads "Unavailable"; the rest of the panel still shows.
 */
const SLUG = 'u1-u9-panel';
const SECRET = 'u1-u9-signing-secret-that-is-long-enough-1234';
let h: Harness;
let admin: string;
let ticketId: string;
let product: FastifyInstance;
let productUrl: string;
let payoutsStatus = 200;

async function startProduct() {
  product = Fastify();
  product.get('/profile/:id', async () => ({
    user: { full_name: 'Samira Lee', mail: 'samira@u1-u9-panel.example' },
  }));
  product.get('/books', async () => ({
    results: [{ isbn: '978-1', title: 'Monsoon Letters', stage: 'printing' }],
  }));
  product.get('/payouts/:id', async (_req, res) =>
    res.status(payoutsStatus).send({ pending: 125000 }),
  );
  productUrl = await product.listen({ port: 0, host: '127.0.0.1' });
}

type Saved = { sources: { id: string; name: string }[]; version: number };

async function connect(): Promise<void> {
  const res = await call(h, 'PUT', '/workspace/connector', admin, {
    version: 0,
    sources: [
      { name: 'Profile', urlTemplate: `${productUrl}/profile/{id}` },
      { name: 'Books', urlTemplate: `${productUrl}/books?email={email}` },
      { name: 'Payouts', urlTemplate: `${productUrl}/payouts/{id}`, cacheSeconds: 0 },
    ],
    apiKey: HOST.apiKey,
    signingSecret: SECRET,
  });
  expect(res.statusCode).toBe(200);
  const saved = res.json<Saved>();
  const idOf = (name: string) => saved.sources.find((s) => s.name === name)!.id;
  const mapped = await call(h, 'PUT', '/workspace/connector/mapping', admin, {
    version: saved.version,
    mapping: {
      name: { sourceId: idOf('Profile'), path: 'user.full_name' },
      email: { sourceId: idOf('Profile'), path: 'user.mail' },
      items: { sourceId: idOf('Books'), path: 'results', idPath: 'isbn', titlePath: 'title' },
    },
  });
  expect(mapped.statusCode).toBe(200);
  const field = (body: Record<string, unknown>) =>
    call(h, 'POST', '/workspace/fields', admin, body);
  const pending = { key: 'account.pending', label: 'Pending payout', type: 'MONEY' };
  expect((await field({ ...pending, sourceId: idOf('Payouts'), path: 'pending' })).statusCode).toBe(
    201,
  );
  const stage = {
    key: 'book.{id}.stage',
    label: 'Stage (per book)',
    type: 'STATUS',
    allowedValues: ['PRINTING'],
  };
  expect((await field({ ...stage, path: 'stage' })).statusCode).toBe(201);
}

const panel = async () => {
  const res = await call(h, 'GET', `/tickets/${ticketId}/customer`, admin);
  expect(res.statusCode).toBe(200);
  return res.json<TicketCustomer>();
};

beforeAll(async () => {
  await startProduct();
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: '50' } });
  await signupWorkspace(h, ownerOf(SLUG, 'U1 U9 Panel'));
  admin = await ownerCookie(h, SLUG);
  const author = await authorCookieOf(h, SLUG);
  await connect();
  h.clock.advance(11_000);
  const res = await createTicket(h, author, {
    bookId: null,
    subject: 'Where is my payout',
    description: 'My payout for last month has not arrived yet, can you check it please?',
  });
  expect(res.statusCode).toBe(201);
  ticketId = res.json<AuthorTicket>().id;
});
afterAll(async () => {
  await deleteWorkspace(h.db, SLUG);
  await h.close();
  await product.close();
});

describe('the Customer panel reads the merged data-source record', () => {
  it('shows the profile, items and field lines from three different sources', async () => {
    const c = await panel();
    expect(c).toMatchObject({
      name: 'Samira Lee',
      email: 'samira@u1-u9-panel.example',
      externalId: `AUTH-${SLUG}`,
      recordsAvailable: true,
    });
    expect(c.account).toContainEqual({
      label: 'Pending payout',
      display: expect.stringContaining('1'),
    });
    expect(c.items).toEqual([
      expect.objectContaining({
        externalId: '978-1',
        title: 'Monsoon Letters',
        lines: expect.arrayContaining([expect.objectContaining({ label: 'Stage' })]),
      }),
    ]);
  });

  it('a failing source marks only its own line Unavailable', async () => {
    payoutsStatus = 500;
    const c = await panel();
    payoutsStatus = 200;
    expect(c.recordsAvailable).toBe(true);
    expect(c.name).toBe('Samira Lee');
    expect(c.account).toContainEqual({ label: 'Pending payout', display: 'Unavailable' });
    expect(c.items.map((i) => i.title)).toEqual(['Monsoon Letters']);
  });
});
