import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, deleteWorkspace, EMAILS, HOST, type Harness } from './helpers/app.js';
import { authorCookieOf, ownerCookie, ownerOf, signupWorkspace } from './helpers/workspaces.js';

/**
 * U-9: a product that keeps profile, books and payouts behind three endpoints of its own shape.
 * The workspace maps them on the Customer data page; support merges them into one record.
 */
const SLUG = 'u9-lending';
const SECRET = 'u9-signing-secret-that-is-long-enough-123456';
let h: Harness;
let admin: string;
let workspaceId: string;
let product: FastifyInstance;
let productUrl: string;
let payoutsStatus = 200;
const seen: { url: string; auth?: string; key?: string }[] = [];

async function startProduct() {
  product = Fastify();
  product.addHook('onRequest', async (req) => {
    const key = req.headers['x-api-key'];
    seen.push({
      url: req.url,
      auth: req.headers.authorization,
      key: typeof key === 'string' ? key : undefined,
    });
  });
  product.get('/v1/profile/:id', async (req, res) =>
    (req.params as { id: string }).id === 'AUTH-u9-lending'
      ? { data: { user: { full_name: 'Sam Lee', mail: 'author@u9-lending.example' } } }
      : res.status(404).send({ error: 'unknown' }),
  );
  product.get('/v1/books', async () => ({
    results: [{ isbn: '978-9', title: 'Rivers', stage: 'printing' }],
  }));
  product.get('/v1/payouts/:id', async (_req, res) =>
    res.status(payoutsStatus).send({ pending: 357000 }),
  );
  productUrl = await product.listen({ port: 0, host: '127.0.0.1' });
}

const SOURCES = () => [
  { name: 'Profile', urlTemplate: `${productUrl}/v1/profile/{id}` },
  { name: 'Books', urlTemplate: `${productUrl}/v1/books?email={email}`, authHeader: 'X-Api-Key' },
  { name: 'Payouts', urlTemplate: `${productUrl}/v1/payouts/{id}`, cacheSeconds: 0 },
];
type Saved = { sources: { id: string; name: string }[]; version: number };
let saved: Saved;
const idOf = (name: string) => saved.sources.find((s) => s.name === name)!.id;

beforeAll(async () => {
  await startProduct();
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: '50' } });
  await signupWorkspace(h, ownerOf(SLUG, 'U9 Lending'));
  admin = await ownerCookie(h, SLUG);
  workspaceId = (await h.db.workspace.findUniqueOrThrow({ where: { slug: SLUG } })).id;
  await authorCookieOf(h, SLUG);
});
afterAll(async () => {
  await deleteWorkspace(h.db, SLUG);
  await h.close();
  await product.close();
});

describe('data sources (U-9)', () => {
  it('refuses a mapping without a session (401) or before the connection is saved (409)', async () => {
    const body = { version: 0, mapping: {} };
    const anonymous = await call(h, 'PUT', '/workspace/connector/mapping', undefined, body);
    expect(anonymous.statusCode).toBe(401);
    const early = await call(h, 'PUT', '/workspace/connector/mapping', admin, body);
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ code: 'CONNECTOR_NOT_SAVED' });
  });

  it('saves one to five sources with their own auth header, timeout and cache', async () => {
    const res = await call(h, 'PUT', '/workspace/connector', admin, {
      version: 0,
      sources: SOURCES(),
      apiKey: HOST.apiKey,
      signingSecret: SECRET,
    });
    expect(res.statusCode).toBe(200);
    saved = res.json<Saved>();
    expect(saved.sources).toEqual([
      expect.objectContaining({ name: 'Profile', format: 'MAPPED', authHeader: null }),
      expect.objectContaining({ name: 'Books', authHeader: 'X-Api-Key' }),
      expect.objectContaining({ name: 'Payouts', cacheSeconds: 0 }),
    ]);
  });

  it('refuses bad source lists (422): six sources, a placeholder in the host, unknown placeholders', async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      name: `S${i}`,
      urlTemplate: `${productUrl}/s/{id}`,
    }));
    for (const sources of [
      six,
      [{ name: 'Evil', urlTemplate: 'https://{id}.example.com/x' }],
      [{ name: 'Odd', urlTemplate: `${productUrl}/x/{name}` }],
    ]) {
      const res = await call(h, 'PUT', '/workspace/connector', admin, {
        version: saved.version,
        sources,
      });
      expect(res.statusCode).toBe(422);
    }
  });

  it('maps name, email and the item list, only to this workspace’s own sources', async () => {
    const bad = await call(h, 'PUT', '/workspace/connector/mapping', admin, {
      version: saved.version,
      mapping: { name: { sourceId: '00000000-0000-4000-8000-000000000000', path: 'x' } },
    });
    expect(bad.statusCode).toBe(422);
    const res = await call(h, 'PUT', '/workspace/connector/mapping', admin, {
      version: saved.version,
      mapping: {
        name: { sourceId: idOf('Profile'), path: 'data.user.full_name' },
        email: { sourceId: idOf('Profile'), path: 'data.user.mail' },
        items: { sourceId: idOf('Books'), path: 'results', idPath: 'isbn', titlePath: 'title' },
      },
    });
    expect(res.statusCode).toBe(200);
    saved = res.json<Saved>();
    expect(res.json()).toMatchObject({ mapping: { items: { path: 'results' } } });
    const stale = await call(h, 'PUT', '/workspace/connector/mapping', admin, {
      version: saved.version - 1,
      mapping: {},
    });
    expect(stale.statusCode).toBe(409);
  });

  it('maps fields to a source and a path; refuses a foreign source and a source on a per-item field', async () => {
    const field = (body: Record<string, unknown>) =>
      call(h, 'POST', '/workspace/fields', admin, body);
    const pending = { key: 'account.pending', label: 'Pending', type: 'MONEY' };
    expect(
      (
        await field({
          ...pending,
          sourceId: '00000000-0000-4000-8000-000000000000',
          path: 'pending',
        })
      ).statusCode,
    ).toBe(422);
    expect(
      (await field({ ...pending, sourceId: idOf('Payouts'), path: 'pending' })).statusCode,
    ).toBe(201);
    const stage = {
      key: 'book.{id}.stage',
      label: 'Stage',
      type: 'STATUS',
      allowedValues: ['PRINTING'],
    };
    expect((await field({ ...stage, sourceId: idOf('Books'), path: 'stage' })).statusCode).toBe(
      422,
    );
    const ok = await field({ ...stage, path: 'stage' });
    expect(ok.json()).toMatchObject({ sourceId: null, path: 'stage' });
  });

  it('serves the merged record through the same records interface the rest of the app uses', async () => {
    h.clock.advance(11_000);
    const c = await h.container.records.customer('AUTH-u9-lending', workspaceId);
    expect(c).toMatchObject({ name: 'Sam Lee', email: 'author@u9-lending.example' });
    expect(c.items).toEqual([expect.objectContaining({ id: '978-9', title: 'Rivers' })]);
    expect(c.items[0]?.facts[0]).toMatchObject({ id: 'book.978-9.stage', value: 'PRINTING' });
    expect(c.facts[0]).toMatchObject({ id: 'account.pending', value: 357000 });
    const books = seen.find((s) => s.url.startsWith('/v1/books'));
    expect(books).toMatchObject({
      url: '/v1/books?email=author%40u9-lending.example',
      key: HOST.apiKey,
    });
    expect(seen.find((s) => s.url.startsWith('/v1/profile'))?.auth).toBe(`Bearer ${HOST.apiKey}`);
  });

  it('keeps the other fields when one source fails, with the missing one unavailable', async () => {
    payoutsStatus = 500;
    const c = await h.container.records.customer('AUTH-u9-lending', workspaceId);
    payoutsStatus = 200;
    expect(c.items).toHaveLength(1);
    expect(c.facts[0]).toMatchObject({
      id: 'account.pending',
      value: null,
      display: 'Unavailable',
    });
  });

  it('Test shows each source’s raw answer and the mapped preview', async () => {
    const res = await call(h, 'POST', '/workspace/connector/test', admin, {
      customerId: 'AUTH-u9-lending',
    });
    const body = res.json<{
      ok: boolean;
      sources: { name: string; ok: boolean; raw: string }[];
      preview: { customer: { name: string } };
    }>();
    expect(body.ok).toBe(true);
    expect(body.sources.map((s) => [s.name, s.ok])).toEqual([
      ['Profile', true],
      ['Books', true],
      ['Payouts', true],
    ]);
    expect(body.sources[1]?.raw).toContain('"Rivers"');
    expect(body.preview.customer.name).toBe('Sam Lee');
  });

  it('removing a source unmaps its fields and its part of the record mapping', async () => {
    const field = await call(h, 'POST', '/workspace/fields', admin, {
      key: 'account.first_book',
      label: 'First book',
      type: 'TEXT',
      sourceId: idOf('Books'),
      path: 'results.0.title',
    });
    expect(field.statusCode).toBe(201);
    const res = await call(h, 'PUT', '/workspace/connector', admin, {
      version: saved.version,
      sources: saved.sources
        .filter((s) => s.name !== 'Books')
        .map((s) => ({ ...SOURCES().find((x) => x.name === s.name), id: s.id })),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      mapping: { items: null, name: { path: 'data.user.full_name' } },
    });
    saved = res.json<Saved>();
    // Fully unmapped (source and path), so the form can save the field again as it is.
    const fields = await call(h, 'GET', '/workspace/fields', admin);
    const firstBook = fields
      .json<{ items: { key: string }[] }>()
      .items.find((f) => f.key === 'account.first_book');
    expect(firstBook).toMatchObject({ sourceId: null, path: null });
  });

  it('only admins may change the mapping (403 for an author)', async () => {
    const author = await h.login(EMAILS.kavita);
    const res = await call(h, 'PUT', '/workspace/connector/mapping', author, {
      version: 0,
      mapping: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('the env-backed default workspace keeps its single fixed-shape source', async () => {
    const bookleaf = await h.login(EMAILS.admin);
    const res = await call(h, 'GET', '/workspace/connector', bookleaf);
    expect(res.json()).toMatchObject({
      source: 'ENV',
      sources: [
        { id: 'env', format: 'CONTRACT', urlTemplate: `${h.hostUrl}/support/customers/{id}` },
      ],
    });
    const test = await call(h, 'POST', '/workspace/connector/test', bookleaf, {
      customerId: 'AUTH001',
    });
    expect(test.json()).toMatchObject({ ok: true, items: 2, preview: { unavailable: [] } });
  });
});

describe('data source URL safety (production policy)', () => {
  let strict: Harness;
  beforeAll(async () => {
    strict = await createHarness({ env: { CONNECTOR_ALLOW_PRIVATE_HOSTS: 'false' } });
  });
  afterAll(() => strict.close());

  it('refuses a private or metadata address in any source (422, on that source)', async () => {
    const cookie = await strict.login(EMAILS.admin);
    const res = await call(strict, 'PUT', '/workspace/connector', cookie, {
      version: 0,
      apiKey: HOST.apiKey,
      signingSecret: SECRET,
      sources: [
        { name: 'Fine', urlTemplate: 'https://93.184.215.14/customers/{id}' },
        { name: 'Metadata', urlTemplate: 'http://169.254.169.254/latest/{id}' },
      ],
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ errors: { path: string }[] }>().errors.map((e) => e.path)).toEqual([
      'sources.1.urlTemplate',
    ]);
  });
});
