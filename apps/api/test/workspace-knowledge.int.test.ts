import type { AdminTicket, AdminTicketListItem } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StructuredRequest } from '../src/ai/providers/types.js';
import { AiAuthError } from '../src/ai/providers/errors.js';
import { BOOKLEAF_ARTICLES } from '../src/modules/categories/bookleaf-knowledge.js';
import {
  call,
  createHarness,
  createTicket,
  defaultHandler,
  deleteWorkspace,
  EMAILS,
  type Harness,
} from './helpers/app.js';
import { authorCookieOf, ownerCookie, ownerOf, signupWorkspace } from './helpers/workspaces.js';

/** S.9: the AI uses only the ticket's own workspace's categories and articles. */
let h: Harness;
let acme: string;
let acmeAuthor: string;
let bookleafAdmin: string;
const ACME = ownerOf('acme-knowledge', 'Acme Corp');

/** Text that only BookLeaf's built-in prompts and knowledge base contain. */
const BOOKLEAF_TEXT = ['BookLeaf', 'royalt', '₹1,000', ...BOOKLEAF_ARTICLES.map((a) => a.title)];
const expectNoBookleaf = (text: string) => {
  for (const phrase of BOOKLEAF_TEXT) expect(text).not.toContain(phrase);
};

/** Picks Acme's BILLING when the prompt offers it, else BookLeaf's royalty category. */
function ai(req: StructuredRequest<unknown>): unknown {
  if (req.task !== 'TRIAGE') return defaultHandler(req);
  const category = req.stableSystem.includes('- BILLING:') ? 'BILLING' : 'ROYALTY_PAYMENTS';
  return {
    category,
    priority: 'MEDIUM',
    priorityReasons: ['x'],
    needsInfo: [],
    confidence: 'high',
  };
}

async function raise(cookie: string, subject: string): Promise<string> {
  const res = await createTicket(h, cookie, {
    bookId: null,
    subject,
    description: `${subject}: my card was charged twice for one order, please refund one.`,
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

beforeAll(async () => {
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: '10' } });
  await deleteWorkspace(h.db, ACME.slug);
  await signupWorkspace(h, ACME);
  [acme, acmeAuthor, bookleafAdmin] = await Promise.all([
    ownerCookie(h, ACME.slug),
    authorCookieOf(h, ACME.slug),
    h.login(EMAILS.admin),
  ]);
  const billing = await call(h, 'POST', '/workspace/categories', acme, {
    key: 'BILLING',
    label: 'Billing',
    description: 'invoices, refunds and card charges',
    defaultPriority: 'HIGH',
    slaHours: 8,
  });
  expect(billing.statusCode).toBe(201);
  const article = await call(h, 'POST', '/workspace/knowledge', acme, {
    title: 'Refund policy',
    body: 'Duplicate charges are refunded within 5 business days.',
    categoryKeys: ['BILLING'],
  });
  expect(article.statusCode).toBe(201);
  // Files share one database: clear jobs other files left queued, so each drain reaches ours.
  while ((await h.drain(200)) > 0);
  h.setAi(ai);
});
afterAll(async () => {
  await deleteWorkspace(h.db, ACME.slug);
  await h.close();
});

/** A test ticket's AI calls, found by its unique subject (ticket ids appear in no prompt). */
const bySubject = (subject: string, task: string) =>
  h.aiCalls.filter((c) => c.task === task && c.user.includes(subject));

describe('an Acme ticket', () => {
  it("is triaged into Acme's own categories, with Acme's SLA hours", async () => {
    const id = await raise(acmeAuthor, 'Double charge one');
    await h.drain();
    const t = await h.db.ticket.findUniqueOrThrow({ where: { id } });
    expect(t).toMatchObject({ categoryKey: 'BILLING', categorySource: 'AI', priority: 'MEDIUM' });
    // MEDIUM alone would allow 48 h; Billing's own 8 h target is sooner.
    expect(t.slaDueAt.getTime() - t.createdAt.getTime()).toBe(8 * 3_600_000);
    const [triage] = bySubject('Double charge one', 'TRIAGE');
    expect(triage?.stableSystem).toContain('- BILLING: invoices, refunds and card charges');
    expect(triage?.stableSystem).not.toContain('ROYALTY_PAYMENTS');
    expectNoBookleaf(triage?.stableSystem ?? '');
    const view = await call(h, 'GET', `/tickets/${id}`, acme);
    expect(view.json<AdminTicket>()).toMatchObject({
      category: 'BILLING',
      categoryLabel: 'Billing',
    });
    // An admin lowering the priority (72 h) still keeps Billing's sooner 8 h target.
    const version = view.json<AdminTicket>().version;
    await call(h, 'PATCH', `/tickets/${id}`, acme, { version, priority: 'LOW' });
    const lowered = await h.db.ticket.findUniqueOrThrow({ where: { id } });
    expect(lowered.slaDueAt.getTime() - lowered.createdAt.getTime()).toBe(8 * 3_600_000);
  });

  it("gets an AI draft from Acme's linked article only, never BookLeaf policy text", async () => {
    await raise(acmeAuthor, 'Double charge two');
    await h.drain();
    const [draft] = bySubject('Double charge two', 'DRAFT');
    expect(draft?.dynamicSystem).toContain('Refund policy');
    expectNoBookleaf(`${draft?.stableSystem}\n${draft?.dynamicSystem}`);
    expect(draft?.stableSystem).toContain('Acme Corp Support');
  });

  it('gets a template draft without BookLeaf text when the AI is down', async () => {
    h.setAi(() => {
      throw new AiAuthError('bad key');
    });
    const id = await raise(acmeAuthor, 'Double charge three');
    await h.drain();
    h.setAi(ai);
    const stored = await h.db.aiDraft.findFirstOrThrow({ where: { ticketId: id } });
    expect(stored.source).toBe('TEMPLATE');
    expectNoBookleaf(stored.body);
    expect(stored.body).toContain('Acme Corp Support');
  });

  it("can only be moved to Acme's active categories, and filters by them", async () => {
    const id = await raise(acmeAuthor, 'Double charge four');
    await h.drain();
    const version = (await call(h, 'GET', `/tickets/${id}`, acme)).json<AdminTicket>().version;
    const foreign = await call(h, 'PATCH', `/tickets/${id}`, acme, {
      version,
      category: 'ROYALTY_PAYMENTS',
    });
    expect(foreign.statusCode).toBe(422);
    const ok = await call(h, 'PATCH', `/tickets/${id}`, acme, {
      version,
      category: 'GENERAL_INQUIRY',
    });
    expect(ok.json<AdminTicket>()).toMatchObject({
      category: 'GENERAL_INQUIRY',
      categorySource: 'ADMIN',
    });
    const list = (await call(h, 'GET', '/tickets?category=BILLING', acme)).json<{
      items: AdminTicketListItem[];
    }>();
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((t) => t.category === 'BILLING')).toBe(true);
    const bl = (await call(h, 'GET', '/tickets?category=BILLING', bookleafAdmin)).json<{
      items: unknown[];
    }>();
    expect(bl.items).toEqual([]);
  });

  it("an admin's article change applies to the very next draft", async () => {
    const [article] = (await call(h, 'GET', '/workspace/knowledge', acme)).json<{
      items: { id: string }[];
    }>().items;
    await call(h, 'PATCH', `/workspace/knowledge/${article?.id}`, acme, { isActive: false });
    await raise(acmeAuthor, 'Double charge five');
    await h.drain();
    const [draft] = bySubject('Double charge five', 'DRAFT');
    expect(draft?.dynamicSystem).not.toContain('Refund policy');
    await call(h, 'PATCH', `/workspace/knowledge/${article?.id}`, acme, { isActive: true });
  });
});

describe('a BookLeaf ticket', () => {
  it("still gets BookLeaf's categories and only its category's knowledge-base section", async () => {
    const priya = await h.login(EMAILS.priya);
    await raise(priya, 'Royalty question six');
    await h.drain();
    const [triage] = bySubject('Royalty question six', 'TRIAGE');
    expect(triage?.stableSystem).toContain('- ROYALTY_PAYMENTS:');
    expect(triage?.stableSystem).not.toContain('BILLING');
    const [draft] = bySubject('Royalty question six', 'DRAFT');
    expect(draft?.dynamicSystem).toContain('Royalty Policy');
    expect(draft?.dynamicSystem).not.toContain('Refund policy');
  });
});
