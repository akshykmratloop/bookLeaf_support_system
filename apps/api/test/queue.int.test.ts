import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let arjun: string;
let admin: string;

interface Item {
  id: string;
  status: string;
  priority: string;
  category: string | null;
  slaDueAt: string;
  createdAt: string;
  assignee: { id: string } | null;
}
const STATUS_RANK = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const PRIORITY_RANK = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

async function ticketWith(change: Record<string, string>): Promise<string> {
  const res = await createTicket(h, arjun, {
    bookId: null,
    subject: 'Queue test',
    description: 'A question about my author account for the queue ordering test.',
  });
  const id = res.json<{ id: string }>().id;
  const version = (await call(h, 'GET', `/tickets/${id}`, admin)).json<{ version: number }>()
    .version;
  const patched = await call(h, 'PATCH', `/tickets/${id}`, admin, { version, ...change });
  expect(patched.statusCode).toBe(200);
  return id;
}

const list = async (query: string) =>
  (await call(h, 'GET', `/tickets?limit=200${query}`, admin)).json<{ items: Item[] }>().items;

beforeAll(async () => {
  h = await createHarness();
  [arjun, admin] = await Promise.all([h.login(EMAILS.arjun), h.login(EMAILS.admin)]);
  await h.drain();
  await ticketWith({ priority: 'LOW', category: 'GENERAL_INQUIRY' });
  await ticketWith({ priority: 'CRITICAL', category: 'ROYALTY_PAYMENTS' });
  await ticketWith({ priority: 'HIGH', category: 'PRINTING_QUALITY', status: 'RESOLVED' });
  await ticketWith({ priority: 'MEDIUM', category: 'ISBN_METADATA', status: 'IN_PROGRESS' });
});
afterAll(() => h.close());

describe('admin queue', () => {
  it('lists unresolved first, then by priority, then by nearest deadline', async () => {
    const items = await list('');
    const key = (t: Item) => [
      STATUS_RANK.indexOf(t.status),
      PRIORITY_RANK.indexOf(t.priority),
      Date.parse(t.slaDueAt),
    ];
    for (let i = 1; i < items.length; i += 1) {
      const [a, b] = [key(items[i - 1]!), key(items[i]!)];
      const firstDiff = a.findIndex((v, j) => v !== b[j]);
      if (firstDiff !== -1) expect(a[firstDiff]!).toBeLessThan(b[firstDiff]!);
    }
  });

  it('filters by category, priority and assignee', async () => {
    const royalty = await list('&category=ROYALTY_PAYMENTS');
    expect(royalty.length).toBeGreaterThan(0);
    expect(royalty.every((t) => t.category === 'ROYALTY_PAYMENTS')).toBe(true);
    const critical = await list('&priority=CRITICAL');
    expect(critical.length).toBeGreaterThan(0);
    expect(critical.every((t) => t.priority === 'CRITICAL')).toBe(true);
    const me = (await call(h, 'GET', '/auth/me', admin)).json<{ user: { id: string } }>().user.id;
    expect((await list('&assignee=me')).every((t) => t.assignee?.id === me)).toBe(true);
    const unassigned = await list('&assignee=unassigned');
    expect(unassigned.length).toBeGreaterThan(0);
    expect(unassigned.every((t) => t.assignee === null)).toBe(true);
  });

  it('sorts oldest or newest first on request, and refuses an unknown sort (422)', async () => {
    const created = (items: Item[]) => items.map((t) => t.createdAt);
    const oldest = created(await list('&sort=oldest'));
    expect(oldest.length).toBeGreaterThan(1);
    expect(oldest).toEqual([...oldest].sort());
    const newest = created(await list('&sort=newest'));
    expect(newest).toEqual([...newest].sort().reverse());
    const bad = await call(h, 'GET', '/tickets?sort=random', admin);
    expect(bad.statusCode).toBe(422);
  });

  it('filters by created date (inclusive day range)', async () => {
    const all = await list('');
    const day = all[0]!.createdAt.slice(0, 10);
    const sameDay = await list(`&from=${day}&to=${day}`);
    expect(sameDay.length).toBeGreaterThan(0);
    expect(sameDay.every((t) => t.createdAt.startsWith(day))).toBe(true);
    expect(await list('&from=2099-01-01')).toEqual([]);
  });
});

describe('reopening', () => {
  it('a CLOSED ticket refuses an author message (409); staff reopen it to OPEN (U-2)', async () => {
    const id = await ticketWith({ status: 'CLOSED' });
    const body = 'Sorry, this is still not sorted. Could you look again please?';
    const refused = await call(h, 'POST', `/tickets/${id}/messages`, arjun, { body });
    expect(refused.statusCode).toBe(409);
    const closed = (await call(h, 'GET', `/tickets/${id}`, admin)).json<{ version: number }>();
    const reopened = await call(h, 'PATCH', `/tickets/${id}`, admin, {
      status: 'OPEN',
      version: closed.version,
    });
    expect(reopened.json<{ status: string }>().status).toBe('OPEN');
    const res = await call(h, 'POST', `/tickets/${id}/messages`, arjun, { body });
    expect(res.statusCode).toBe(201);
  });
});
