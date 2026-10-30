import type { Article, Category, CategoryOption } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, deleteWorkspace, EMAILS, type Harness } from './helpers/app.js';
import { authorCookieOf, ownerCookie, ownerOf, signupWorkspace } from './helpers/workspaces.js';

/** S.9: each workspace manages its own ticket categories and knowledge base. */
let h: Harness;
let acme: string;
let other: string;
let acmeAuthor: string;
let bookleaf: string;
const ACME = ownerOf('acme-categories', 'Acme Categories');
const OTHER = ownerOf('other-categories', 'Other Categories');

const billing = {
  key: 'BILLING',
  label: 'Billing',
  description: 'Invoices, refunds and card charges.',
  defaultPriority: 'HIGH',
  slaHours: 8,
};

const categories = async (cookie: string) =>
  (await call(h, 'GET', '/workspace/categories', cookie)).json<{ items: Category[] }>().items;
const articles = async (cookie: string) =>
  (await call(h, 'GET', '/workspace/knowledge', cookie)).json<{ items: Article[] }>().items;

beforeAll(async () => {
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: '10' } });
  for (const o of [ACME, OTHER]) await deleteWorkspace(h.db, o.slug);
  for (const o of [ACME, OTHER]) await signupWorkspace(h, o);
  [acme, other, acmeAuthor, bookleaf] = await Promise.all([
    ownerCookie(h, ACME.slug),
    ownerCookie(h, OTHER.slug),
    authorCookieOf(h, ACME.slug),
    h.login(EMAILS.admin),
  ]);
});
afterAll(async () => {
  for (const o of [ACME, OTHER]) await deleteWorkspace(h.db, o.slug);
  await h.close();
});

describe('starting data', () => {
  it('a new workspace starts with one General Inquiry category and no articles', async () => {
    expect((await categories(acme)).map((c) => [c.key, c.label, c.isActive])).toEqual([
      ['GENERAL_INQUIRY', 'General Inquiry', true],
    ]);
    expect(await articles(acme)).toEqual([]);
  });

  it('BookLeaf has its six categories and its knowledge base as linked articles', async () => {
    expect((await categories(bookleaf)).map((c) => c.key)).toEqual([
      'ROYALTY_PAYMENTS',
      'ISBN_METADATA',
      'PRINTING_QUALITY',
      'DISTRIBUTION_AVAILABILITY',
      'BOOK_STATUS_PRODUCTION',
      'GENERAL_INQUIRY',
    ]);
    const kb = await articles(bookleaf);
    expect(kb.map((a) => a.title)).toContain('Royalty Policy');
    expect(kb.find((a) => a.title === 'Royalty Policy')?.categoryKeys).toEqual([
      'ROYALTY_PAYMENTS',
    ]);
  });
});

describe('categories', () => {
  it('needs a signed-in staff member of the workspace', async () => {
    expect((await call(h, 'GET', '/workspace/categories')).statusCode).toBe(401);
    expect((await call(h, 'GET', '/workspace/categories', acmeAuthor)).statusCode).toBe(403);
    expect((await call(h, 'POST', '/workspace/categories', acmeAuthor, billing)).statusCode).toBe(
      403,
    );
  });

  it('adds a category at the end, strips HTML, and refuses a taken key (409)', async () => {
    const res = await call(h, 'POST', '/workspace/categories', acme, {
      ...billing,
      label: '<script>alert(1)</script>Billing',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<Category>()).toMatchObject({
      key: 'BILLING',
      label: 'alert(1)Billing',
      position: 1,
    });
    const again = await call(h, 'POST', '/workspace/categories', acme, billing);
    expect(again.statusCode).toBe(409);
    expect(again.json<{ code: string }>().code).toBe('CATEGORY_KEY_TAKEN');
    // Another workspace may use the same key.
    expect((await call(h, 'POST', '/workspace/categories', other, billing)).statusCode).toBe(201);
  });

  it.each([
    ['a lowercase key', { key: 'billing' }],
    ['an injection key', { key: "B'; DROP TABLE tickets;--" }],
    ['a 61-character label', { label: 'x'.repeat(61) }],
    ['SLA hours 0', { slaHours: 0 }],
    ['SLA hours 721', { slaHours: 721 }],
    ['an unknown priority', { defaultPriority: 'URGENT' }],
  ])('refuses %s (422)', async (_name, change) => {
    const res = await call(h, 'POST', '/workspace/categories', acme, {
      ...billing,
      key: 'NEW_ONE',
      ...change,
    });
    expect(res.statusCode).toBe(422);
  });

  it("edits its own category but never another workspace's (404)", async () => {
    const own = (await categories(acme)).find((c) => c.key === 'BILLING');
    const theirs = (await categories(other)).find((c) => c.key === 'BILLING');
    const res = await call(h, 'PATCH', `/workspace/categories/${own?.id}`, acme, {
      label: 'Payments',
    });
    expect(res.json<Category>()).toMatchObject({ key: 'BILLING', label: 'Payments' });
    const cross = await call(h, 'PATCH', `/workspace/categories/${theirs?.id}`, acme, {
      label: 'X',
    });
    expect(cross.statusCode).toBe(404);
    expect((await categories(other)).find((c) => c.key === 'BILLING')?.label).toBe('Billing');
  });

  it('reorders only with every id exactly once, and keeps the last active category', async () => {
    const ids = (await categories(acme)).map((c) => c.id);
    const reversed = [...ids].reverse();
    const res = await call(h, 'PUT', '/workspace/categories/order', acme, { ids: reversed });
    expect(res.json<{ items: Category[] }>().items.map((c) => c.id)).toEqual(reversed);
    const partial = await call(h, 'PUT', '/workspace/categories/order', acme, { ids: [ids[0]] });
    expect(partial.statusCode).toBe(422);
    const [first, second] = ids;
    expect(
      (await call(h, 'PATCH', `/workspace/categories/${first}`, acme, { isActive: false }))
        .statusCode,
    ).toBe(200);
    const last = await call(h, 'PATCH', `/workspace/categories/${second}`, acme, {
      isActive: false,
    });
    expect(last.statusCode).toBe(409);
    expect(last.json<{ code: string }>().code).toBe('LAST_ACTIVE_CATEGORY');
    await call(h, 'PATCH', `/workspace/categories/${first}`, acme, { isActive: true });
  });

  it('offers signed-in authors and staff only the active categories', async () => {
    const res = await call(h, 'GET', '/categories', acmeAuthor);
    expect(
      res
        .json<{ items: CategoryOption[] }>()
        .items.map((c) => c.key)
        .sort(),
    ).toEqual(['BILLING', 'GENERAL_INQUIRY']);
    expect((await call(h, 'GET', '/categories')).statusCode).toBe(401);
  });
});

describe('knowledge base', () => {
  const refund = {
    title: 'Refund policy',
    body: 'Refunds within 14 days.',
    categoryKeys: ['BILLING'],
  };

  it("adds articles linked only to the workspace's own categories", async () => {
    const res = await call(h, 'POST', '/workspace/knowledge', acme, refund);
    expect(res.statusCode).toBe(201);
    expect(res.json<Article>()).toMatchObject({
      categoryKeys: ['BILLING'],
      isActive: true,
      position: 0,
    });
    const foreign = { ...refund, categoryKeys: ['ROYALTY_PAYMENTS'] };
    expect((await call(h, 'POST', '/workspace/knowledge', acme, foreign)).statusCode).toBe(422);
    expect(
      (await call(h, 'POST', '/workspace/knowledge', acme, { ...refund, body: '' })).statusCode,
    ).toBe(422);
    expect((await call(h, 'POST', '/workspace/knowledge', acmeAuthor, refund)).statusCode).toBe(
      403,
    );
  });

  it("relinks, deactivates and reorders its own articles, never another workspace's", async () => {
    await call(h, 'POST', '/workspace/knowledge', acme, { title: 'Hours', body: 'Mon–Fri.' });
    const [a, b] = await articles(acme);
    const relinked = await call(h, 'PATCH', `/workspace/knowledge/${a?.id}`, acme, {
      categoryKeys: ['GENERAL_INQUIRY', 'BILLING'],
      isActive: false,
    });
    expect(relinked.json<Article>()).toMatchObject({
      categoryKeys: ['BILLING', 'GENERAL_INQUIRY'],
      isActive: false,
    });
    const order = await call(h, 'PUT', '/workspace/knowledge/order', acme, { ids: [b?.id, a?.id] });
    expect(order.json<{ items: Article[] }>().items.map((x) => x.title)).toEqual([
      'Hours',
      'Refund policy',
    ]);
    expect(
      (await call(h, 'PATCH', `/workspace/knowledge/${a?.id}`, other, { title: 'X' })).statusCode,
    ).toBe(404);
    const otherOrder = await call(h, 'PUT', '/workspace/knowledge/order', other, { ids: [a?.id] });
    expect(otherOrder.statusCode).toBe(422);
  });
});
