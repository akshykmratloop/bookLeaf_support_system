import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HostUnavailableError } from '../errors.js';
import { probeSources, sourcesHostRecords } from './records.js';
import type { SourcesConfig, SourceSpec } from './types.js';

const API_KEY = 'unit-test-sources-api-key-123456';

/** A real HTTP server playing a product with three endpoints; tests decide how they answer. */
let host: FastifyInstance;
let base: string;
let calls: { path: string; auth?: string; key?: string }[];
let payoutsStatus: number;

beforeAll(async () => {
  host = Fastify();
  host.addHook('onRequest', async (req) => {
    calls.push({
      path: req.url,
      auth: req.headers.authorization,
      key: req.headers['x-api-key'] as string | undefined,
    });
  });
  host.get('/profile/:id', async () => ({ user: { name: 'Asha Rao', mail: 'asha@x.com' } }));
  host.get('/books', async () => [{ isbn: '978-1', title: 'Monsoon' }]);
  host.get('/payouts/:id', async (_req, res) => res.status(payoutsStatus).send({ pending: 1200 }));
  host.get('/unused/:id', async () => ({}));
  base = await host.listen({ port: 0, host: '127.0.0.1' });
});
afterAll(() => host.close());
beforeEach(() => {
  calls = [];
  payoutsStatus = 200;
});

const spec = (id: string, urlTemplate: string, over: Partial<SourceSpec> = {}): SourceSpec => ({
  id,
  name: id,
  urlTemplate: `${base}${urlTemplate}`,
  format: 'MAPPED',
  authHeader: null,
  timeoutMs: 500,
  cacheSeconds: 60,
  ...over,
});

const clock = 0;
const config = (over: Partial<SourcesConfig> = {}): SourcesConfig => ({
  apiKey: API_KEY,
  sources: [
    spec('profile', '/profile/{id}'),
    spec('books', '/books?email={email}', { authHeader: 'X-Api-Key' }),
    spec('payouts', '/payouts/{id}'),
    spec('unused', '/unused/{id}'),
  ],
  mapping: {
    record: {
      name: { sourceId: 'profile', path: 'user.name' },
      email: { sourceId: 'profile', path: 'user.mail' },
      items: { sourceId: 'books', path: '$', idPath: 'isbn', titlePath: 'title' },
    },
    fields: [
      {
        key: 'account.pending',
        label: 'Pending',
        type: 'MONEY',
        allowedValues: [],
        visibleToCustomer: true,
        sourceId: 'payouts',
        path: 'pending',
      },
    ],
  },
  emailOf: async () => 'asha@x.com',
  ...over,
});

describe('sourcesHostRecords', () => {
  it('calls only the sources the mapping needs, with each source’s auth, and merges them', async () => {
    const c = await sourcesHostRecords(config(), () => clock).customer('C1');
    expect(c.name).toBe('Asha Rao');
    expect(c.items.map((i) => i.id)).toEqual(['978-1']);
    expect(c.facts[0]).toMatchObject({ id: 'account.pending', value: 1200 });
    expect(calls.map((x) => x.path).sort()).toEqual([
      '/books?email=asha%40x.com',
      '/payouts/C1',
      '/profile/C1',
    ]);
    const books = calls.find((x) => x.path.startsWith('/books'));
    expect(books).toMatchObject({ key: API_KEY, auth: undefined });
    expect(calls.find((x) => x.path === '/profile/C1')?.auth).toBe(`Bearer ${API_KEY}`);
  });

  it('caches each source for its own time', async () => {
    const short = config();
    short.sources = short.sources.map((s) => (s.id === 'payouts' ? { ...s, cacheSeconds: 0 } : s));
    const records = sourcesHostRecords(short, () => clock);
    await records.customer('C1');
    await records.customer('C1');
    expect(calls.filter((x) => x.path === '/payouts/C1')).toHaveLength(2);
    expect(calls.filter((x) => x.path === '/profile/C1')).toHaveLength(1);
  });

  it('still answers when one source fails, with that field unavailable', async () => {
    payoutsStatus = 503;
    const c = await sourcesHostRecords(config(), () => clock).customer('C1');
    expect(c.items).toHaveLength(1);
    expect(c.facts[0]).toMatchObject({ id: 'account.pending', display: 'Unavailable' });
  });

  it('re-checks every source URL before calling it (SSRF), and calls nothing it refuses', async () => {
    const refuse = async () => {
      throw new Error('private or internal addresses');
    };
    await expect(
      sourcesHostRecords(config({ checkUrl: refuse }), () => clock).customer('C1'),
    ).rejects.toBeInstanceOf(HostUnavailableError);
    expect(calls).toEqual([]);
  });
});

describe('probeSources (the Test button)', () => {
  it('shows every source’s raw answer and the merged preview', async () => {
    payoutsStatus = 500;
    const r = await probeSources(config(), 'C1', null);
    expect(r.sources.map((s) => [s.name, s.ok, s.status])).toEqual([
      ['profile', true, 200],
      ['books', true, 200],
      ['payouts', false, 500],
      ['unused', true, 200],
    ]);
    expect(r.sources[0]?.raw).toContain('"Asha Rao"');
    expect(r.preview.customer?.name).toBe('Asha Rao');
    expect(r.preview.unavailable).toEqual([
      { key: 'account.pending', reason: 'payouts: status 500' },
    ]);
  });

  it('reports a missing email instead of calling an {email} source', async () => {
    const r = await probeSources(config({ emailOf: async () => null }), 'C1', null);
    expect(r.sources[1]).toMatchObject({ ok: false, status: null });
    expect(calls.some((x) => x.path.startsWith('/books'))).toBe(false);
  });
});
