import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthorTicket, AuthorTicketListItem } from '@bookleaf/shared';
import { call, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let priya: string;
let rohit: string;
let admin: string;

const DESCRIPTION = 'My royalty statement for this quarter looks lower than my sales.';
const REPLY =
  'Hi Priya, thank you for your patience. Our team is checking your statement and will update you here.';

async function newTicket(): Promise<string> {
  const res = await createTicket(h, priya, {
    bookId: null,
    subject: 'Statement looks low',
    description: DESCRIPTION,
  });
  expect(res.statusCode).toBe(201);
  return res.json<AuthorTicket>().id;
}

const listItem = async (id: string) =>
  (await call(h, 'GET', '/tickets?limit=200', priya))
    .json<{ items: AuthorTicketListItem[] }>()
    .items.find((t) => t.id === id);
const detail = async (id: string) =>
  (await call(h, 'GET', `/tickets/${id}`, priya)).json<AuthorTicket>();
const solve = (id: string, cookie: string | undefined) =>
  call(h, 'POST', `/tickets/${id}/solve`, cookie, {});

beforeAll(async () => {
  h = await createHarness();
  [priya, rohit, admin] = await Promise.all([
    h.login(EMAILS.priya),
    h.login(EMAILS.rohit),
    h.login(EMAILS.admin),
  ]);
});
afterAll(() => h.close());

describe('the requester view of a ticket', () => {
  it('shows type, channel and my own last message, without internal fields', async () => {
    const id = await newTicket();
    await h.drain();
    const item = await listItem(id);
    expect(item).toMatchObject({
      channel: 'PORTAL',
      awaitingYou: false,
      canSolve: true,
      lastActivity: { from: 'YOU', preview: DESCRIPTION },
    });
    expect(item?.category).toEqual(expect.any(String));
    const one = await detail(id);
    expect(one).toMatchObject({ channel: 'PORTAL', awaitingYou: false, canSolve: true });
    for (const field of ['priority', 'slaDueAt', 'aiState', 'assignee', 'needsReview'])
      expect(one).not.toHaveProperty(field);
  });

  it('says it needs my reply once the team has answered, until I answer', async () => {
    const id = await newTicket();
    const sent = await call(h, 'POST', `/tickets/${id}/messages`, admin, { body: REPLY });
    expect(sent.statusCode).toBe(201);
    expect(await listItem(id)).toMatchObject({
      awaitingYou: true,
      lastActivity: { from: 'TEAM', preview: REPLY },
    });
    expect((await detail(id)).awaitingYou).toBe(true);
    await call(h, 'POST', `/tickets/${id}/messages`, priya, { body: 'Thanks, I will wait.' });
    expect(await listItem(id)).toMatchObject({
      awaitingYou: false,
      lastActivity: { from: 'YOU', preview: 'Thanks, I will wait.' },
    });
  });

  it('cuts a long last message to a short preview', async () => {
    const id = await newTicket();
    const long = `Hi Priya, ${'we are looking into this for you. '.repeat(12)}`;
    await call(h, 'POST', `/tickets/${id}/messages`, admin, { body: long });
    const preview = (await listItem(id))?.lastActivity.preview ?? '';
    expect(preview.length).toBeLessThanOrEqual(141);
    expect(preview.endsWith('…')).toBe(true);
  });
});

describe('marking a ticket as solved', () => {
  it('solves my open ticket once, records it, and shows the new status', async () => {
    const id = await newTicket();
    const res = await solve(id, priya);
    expect(res.statusCode).toBe(200);
    expect(res.json<AuthorTicket>()).toMatchObject({ status: 'RESOLVED', canSolve: false });
    const audit = await h.db.auditEvent.findFirst({
      where: { entityId: id, action: 'ticket.solved_by_author' },
    });
    expect(audit).not.toBeNull();
    const again = await solve(id, priya);
    expect(again.statusCode).toBe(409);
    expect(again.json<{ code: string }>().code).toBe('ALREADY_SOLVED');
  });

  it('requires sign-in (401), an author (403) and my own ticket (404)', async () => {
    const id = await newTicket();
    expect((await solve(id, undefined)).statusCode).toBe(401);
    expect((await solve(id, admin)).statusCode).toBe(403);
    expect((await solve(id, rohit)).statusCode).toBe(404);
    expect((await detail(id)).status).not.toBe('RESOLVED');
  });
});
