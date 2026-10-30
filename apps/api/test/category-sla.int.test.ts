import type { AdminTicket } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StructuredRequest } from '../src/ai/providers/types.js';
import {
  call,
  createHarness,
  createTicket,
  defaultHandler,
  deleteWorkspace,
  type Harness,
} from './helpers/app.js';
import { authorCookieOf, ownerCookie, ownerOf, signupWorkspace } from './helpers/workspaces.js';

/**
 * S.9 review fix: a category's own SLA hours follow the category the ticket ends up in, whoever
 * moves it (an admin's PATCH or a fresh triage) and whether or not the priority changes too.
 */
let h: Harness;
let admin: string;
let author: string;
const ACME = ownerOf('acme-category-sla', 'Acme SLA Co');
const HOUR = 3_600_000;

/** Triage puts every ticket in `category` at MEDIUM. */
const triageInto = (category: string) => (req: StructuredRequest<unknown>) =>
  req.task !== 'TRIAGE'
    ? defaultHandler(req)
    : { category, priority: 'MEDIUM', priorityReasons: ['x'], needsInfo: [], confidence: 'high' };

async function raise(subject: string): Promise<string> {
  const res = await createTicket(h, author, {
    bookId: null,
    subject,
    description: `${subject}: my card was charged twice for one order, please refund one.`,
  });
  expect(res.statusCode).toBe(201);
  await h.drain();
  return res.json<{ id: string }>().id;
}

const view = async (id: string) =>
  (await call(h, 'GET', `/tickets/${id}`, admin)).json<AdminTicket>();

async function patch(id: string, body: Record<string, unknown>) {
  const res = await call(h, 'PATCH', `/tickets/${id}`, admin, {
    version: (await view(id)).version,
    ...body,
  });
  expect(res.statusCode).toBe(200);
}

/** Hours from the ticket's creation to its first-response deadline. */
async function slaHours(id: string): Promise<number> {
  const t = await h.db.ticket.findUniqueOrThrow({ where: { id } });
  return (t.slaDueAt.getTime() - t.createdAt.getTime()) / HOUR;
}

beforeAll(async () => {
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: '10' } });
  await deleteWorkspace(h.db, ACME.slug);
  await signupWorkspace(h, ACME);
  [admin, author] = await Promise.all([ownerCookie(h, ACME.slug), authorCookieOf(h, ACME.slug)]);
  const urgent = await call(h, 'POST', '/workspace/categories', admin, {
    key: 'URGENT',
    label: 'Urgent',
    description: 'outages and anything blocking the customer right now',
    defaultPriority: 'HIGH',
    slaHours: 4,
  });
  expect(urgent.statusCode).toBe(201);
  // Files share one database: clear jobs other files left queued, so each drain reaches ours.
  while ((await h.drain(200)) > 0);
});
afterAll(async () => {
  await deleteWorkspace(h.db, ACME.slug);
  await h.close();
});

describe('an admin moving a ticket to another category', () => {
  it("applies the new category's SLA hours when only the category changes", async () => {
    h.setAi(triageInto('GENERAL_INQUIRY'));
    const id = await raise('Category only move');
    expect(await slaHours(id)).toBe(48);
    await patch(id, { category: 'URGENT' });
    expect(await slaHours(id)).toBe(4);
    await patch(id, { category: 'GENERAL_INQUIRY' });
    expect(await slaHours(id)).toBe(48);
  });

  it('uses the new category, not the old one, when category and priority change together', async () => {
    h.setAi(triageInto('URGENT'));
    const id = await raise('Category and priority move');
    expect(await slaHours(id)).toBe(4);
    await patch(id, { category: 'GENERAL_INQUIRY', priority: 'LOW' });
    expect(await slaHours(id)).toBe(72);
    await patch(id, { category: 'URGENT', priority: 'LOW' });
    expect(await slaHours(id)).toBe(4);
  });
});

describe('a fresh triage moving the category of a ticket whose priority an admin set', () => {
  it("keeps the admin's priority and applies the new category's SLA hours", async () => {
    h.setAi(triageInto('GENERAL_INQUIRY'));
    const id = await raise('Retriage after admin priority');
    await patch(id, { priority: 'HIGH' });
    expect(await slaHours(id)).toBe(24);
    h.setAi(triageInto('URGENT'));
    expect((await call(h, 'POST', `/tickets/${id}/ai/retry`, admin)).statusCode).toBe(202);
    await h.drain();
    const t = await h.db.ticket.findUniqueOrThrow({ where: { id } });
    expect(t).toMatchObject({ categoryKey: 'URGENT', priority: 'HIGH', prioritySource: 'ADMIN' });
    expect(await slaHours(id)).toBe(4);
  });
});
