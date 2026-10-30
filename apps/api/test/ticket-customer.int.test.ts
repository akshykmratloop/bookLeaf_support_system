import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthorTicket, TicketCustomer } from '@bookleaf/shared';
import {
  call,
  createHarness,
  createTicket,
  deleteWorkspace,
  EMAILS,
  type Harness,
} from './helpers/app.js';
import { ownerCookie, ownerOf, signupWorkspace } from './helpers/workspaces.js';

/**
 * U-1: the staff ticket page's Customer panel. Profile and record facts come from the
 * customer record (labelled by the workspace's customer data fields), plus every other ticket
 * of this customer in this workspace.
 */
let h: Harness;
let priya: string;
let rohit: string;
let admin: string;

const OTHER_SLUG = 'customer-panel-co';

const customerOf = (id: string, cookie: string | undefined) =>
  call(h, 'GET', `/tickets/${id}/customer`, cookie);

async function ticketFor(cookie: string, subject: string, book: string | null = null) {
  const res = await createTicket(h, cookie, {
    bookId: book,
    subject,
    description: 'I would like to know more about my royalty and the next payout date.',
  });
  expect(res.statusCode).toBe(201);
  return res.json<AuthorTicket>();
}

const priyasBook = async () =>
  (await h.db.book.findFirstOrThrow({ where: { author: { user: { email: EMAILS.priya } } } })).id;

beforeAll(async () => {
  h = await createHarness();
  [priya, rohit, admin] = await Promise.all([
    h.login(EMAILS.priya),
    h.login(EMAILS.rohit),
    h.login(EMAILS.admin),
  ]);
});
afterAll(async () => {
  await deleteWorkspace(h.db, OTHER_SLUG);
  await h.close();
});

describe('the Customer panel of a ticket', () => {
  it('shows the profile, the items with their details and the field-labelled facts', async () => {
    const book = await priyasBook();
    const t = await ticketFor(priya, 'Royalty question for my book', book);
    const res = await customerOf(t.id, admin);
    expect(res.statusCode).toBe(200);
    const c = res.json<TicketCustomer>();
    expect(c).toMatchObject({ name: 'Priya Sharma', email: EMAILS.priya, recordsAvailable: true });
    expect(c.itemNoun).toEqual(expect.any(String));
    const own = c.items.find((i) => i.id === book);
    expect(own?.isTicketItem).toBe(true);
    expect(c.items.filter((i) => i.isTicketItem)).toHaveLength(1);
    // The product's own lines come first, e.g. what the customer sees on their account page.
    expect(own?.lines.map((l) => l.label)).toContain('Royalty pending');
    expect(own?.lines.map((l) => l.label)).toContain('Last payout');
    // Facts are labelled by the workspace's customer data fields (BookLeaf's seeded fields).
    const account = c.account.map((l) => l.label);
    expect(account).toContain('Payout eligibility');
    expect(account).toContain('Next payout deadline');
    // A per-item field drops its "(per book)" suffix inside the item.
    expect(own?.lines.map((l) => l.label)).toContain('Royalty status');
    // A fact that repeats a line already shown is not shown twice.
    for (const lines of [c.account, ...c.items.map((i) => i.lines)]) {
      const names = lines.map((l) => l.label.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("lists this customer's other tickets in this workspace, without the current one", async () => {
    const first = await ticketFor(priya, 'First question about payouts');
    const second = await ticketFor(priya, 'Second question about payouts');
    const theirs = await ticketFor(rohit, 'Someone else entirely');
    const c = (await customerOf(second.id, admin)).json<TicketCustomer>();
    const ids = c.otherTickets.map((o) => o.id);
    expect(ids).toContain(first.id);
    expect(ids).not.toContain(second.id);
    expect(ids).not.toContain(theirs.id);
    expect(c.otherTickets.find((o) => o.id === first.id)).toMatchObject({
      number: first.number,
      subject: first.subject,
      status: 'OPEN',
    });
  });
});

describe('who may see the Customer panel', () => {
  it('needs a sign-in (401), staff (403) and a ticket in my workspace (404)', async () => {
    const t = await ticketFor(priya, 'Permission checks for the panel');
    expect((await customerOf(t.id, undefined)).statusCode).toBe(401);
    expect((await customerOf(t.id, priya)).statusCode).toBe(403);
    await signupWorkspace(h, ownerOf(OTHER_SLUG, 'Customer Panel Co'));
    expect((await customerOf(t.id, await ownerCookie(h, OTHER_SLUG))).statusCode).toBe(404);
  });
});

// Last in the file: it stops the demo product.
describe('when the product is down', () => {
  it('still shows the profile and the tickets, and says the records are unavailable', async () => {
    const older = await ticketFor(priya, 'Asked before the product went down');
    const t = await ticketFor(priya, 'Asked while the product is down');
    await h.stopHost();
    h.clock.advance(61_000); // past the 60 s records cache
    const res = await customerOf(t.id, admin);
    expect(res.statusCode).toBe(200);
    const c = res.json<TicketCustomer>();
    expect(c).toMatchObject({ email: EMAILS.priya, recordsAvailable: false, account: [] });
    expect(c.items.every((i) => i.lines.length === 0)).toBe(true);
    expect(c.otherTickets.map((o) => o.id)).toContain(older.id);
  });
});
