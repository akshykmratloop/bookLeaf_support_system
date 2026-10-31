import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let arjun: string;
let admin: string;
const tag = `Cursor walk ${randomUUID().slice(0, 8)}`;

interface Page {
  items: { id: string; createdAt: string }[];
  nextCursor: string | null;
}

async function ticket(priority: string): Promise<string> {
  const res = await createTicket(h, arjun, {
    bookId: null,
    subject: `${tag} ${priority}`,
    description: 'A question about my author account for the cursor paging test.',
  });
  return res.json<{ id: string }>().id;
}

async function setPriority(id: string, priority: string) {
  const { version } = (await call(h, 'GET', `/tickets/${id}`, admin)).json<{ version: number }>();
  const res = await call(h, 'PATCH', `/tickets/${id}`, admin, { version, priority });
  expect(res.statusCode).toBe(200);
}

const fetchPage = async (query: string, cookie = admin) => {
  const res = await call(h, 'GET', `/tickets?q=${encodeURIComponent(tag)}${query}`, cookie);
  expect(res.statusCode).toBe(200);
  return res.json<Page>();
};

async function walk(query: string, between?: (p: Page) => Promise<void>): Promise<string[]> {
  const seen: string[] = [];
  let page = await fetchPage(query);
  seen.push(...page.items.map((t) => t.id));
  if (between) await between(page);
  while (page.nextCursor) {
    page = await fetchPage(`${query}&cursor=${page.nextCursor}`);
    seen.push(...page.items.map((t) => t.id));
  }
  return seen;
}

const ids: Record<string, string> = {};
const START = [
  ['critical', 'CRITICAL'],
  ['highA', 'HIGH'],
  ['highB', 'HIGH'],
  ['medium', 'MEDIUM'],
  ['low', 'LOW'],
] as const;

beforeAll(async () => {
  h = await createHarness();
  [arjun, admin] = await Promise.all([h.login(EMAILS.arjun), h.login(EMAILS.admin)]);
  for (const [name, priority] of START) ids[name] = await ticket(priority);
  await h.drain();
  // Triage may have changed them: pin each priority by hand.
  for (const [name, priority] of START) await setPriority(ids[name]!, priority);
});
afterAll(() => h.close());

describe('ticket list cursor', () => {
  it('walks every page exactly once, in each sort', async () => {
    for (const sort of ['urgency', 'oldest', 'newest']) {
      const all = await walk(`&sort=${sort}&limit=2`);
      expect(new Set(all).size).toBe(5);
      expect(all).toHaveLength(5);
    }
  });

  it('a ticket that moves between page fetches neither skips nor repeats the others', async () => {
    const all = await walk('&limit=2', async (first) => {
      const last = first.items[first.items.length - 1]!;
      // The last row shown drops to the bottom of the queue before page 2 is read.
      await setPriority(last.id, 'LOW');
      ids.moved = last.id;
    });
    const others = Object.values(ids).filter((id) => id !== ids.moved);
    for (const id of others) expect(all.filter((x) => x === id)).toHaveLength(1);
    await setPriority(ids.moved!, 'HIGH');
  });

  it('refuses a malformed cursor, and a cursor made for another sort (422)', async () => {
    const bad = await call(h, 'GET', '/tickets?cursor=not-a-cursor', admin);
    expect(bad.statusCode).toBe(422);
    const legacy = await call(h, 'GET', `/tickets?cursor=${randomUUID()}`, admin);
    expect(legacy.statusCode).toBe(422);
    const urgency = await fetchPage('&limit=1');
    const wrongSort = await call(
      h,
      'GET',
      `/tickets?sort=oldest&cursor=${urgency.nextCursor}`,
      admin,
    );
    expect(wrongSort.statusCode).toBe(422);
  });

  it('pages an author list newest first by the same rule', async () => {
    const first = await fetchPage('&limit=2', arjun);
    const rest = await fetchPage(`&limit=10&cursor=${first.nextCursor}`, arjun);
    const all = [...first.items, ...rest.items].map((t) => t.createdAt);
    expect(all).toHaveLength(5);
    expect(all).toEqual([...all].sort().reverse());
  });
});

describe('date filters in the viewer time zone', () => {
  it('a ticket made at 19:00 UTC on 31 Oct is on 1 Nov in Kolkata and on 31 Oct in UTC', async () => {
    const at = new Date('2026-10-31T19:00:00Z');
    await h.db.ticket.update({ where: { id: ids.low! }, data: { createdAt: at } });
    const on = async (day: string, tz?: string) =>
      (await fetchPage(`&from=${day}&to=${day}${tz ? `&tz=${tz}` : ''}`)).items.map((t) => t.id);
    expect(await on('2026-11-01', 'Asia/Kolkata')).toContain(ids.low);
    expect(await on('2026-10-31', 'Asia/Kolkata')).not.toContain(ids.low);
    expect(await on('2026-10-31')).toContain(ids.low);
    expect(await on('2026-10-31', 'UTC')).toContain(ids.low);
    expect(await on('2026-11-01', 'UTC')).not.toContain(ids.low);
  });

  it('refuses an unknown time zone (422)', async () => {
    const res = await call(h, 'GET', '/tickets?tz=Mars/Olympus', admin);
    expect(res.statusCode).toBe(422);
  });
});

describe('ticket view bounds', () => {
  it('shows the newest 500 messages, oldest first', async () => {
    const id = ids.medium!;
    const base = Date.parse('2030-01-01T00:00:00Z');
    await h.db.ticketMessage.createMany({
      data: Array.from({ length: 505 }, (_, i) => ({
        ticketId: id,
        kind: 'INTERNAL_NOTE' as const,
        body: `bulk ${i}`,
        createdAt: new Date(base + i * 1000),
      })),
    });
    const view = (await call(h, 'GET', `/tickets/${id}`, admin)).json<{
      messages: { body: string }[];
    }>();
    expect(view.messages).toHaveLength(500);
    expect(view.messages[0]?.body).toBe('bulk 5');
    expect(view.messages[499]?.body).toBe('bulk 504');
  });
});
