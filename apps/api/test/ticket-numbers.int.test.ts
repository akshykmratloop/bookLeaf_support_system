import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, createTicket, deleteWorkspace, type Harness } from './helpers/app.js';

/**
 * F-13: every workspace numbers its own tickets from 1001 under a fixed, platform-unique prefix,
 * so no workspace can read another's ticket volume from its numbers.
 */
let h: Harness;

const owner = (slug: string, workspaceName: string) => ({
  workspaceName,
  slug,
  ownerName: 'Numbers Owner',
  email: `owner@${slug}.example`,
  password: 'Correct-Horse-42',
});
const QUILL = owner('quill-works', 'Quill Works');
const QUICK = owner('quick-wit', 'Quick Wit');
const RACERS = [1, 2, 3, 4, 5].map((n) => owner(`zany-yak-${n}`, 'Zany Yak'));
const ALL = [QUILL, QUICK, ...RACERS];

const valid = {
  bookId: null,
  subject: 'Question about my account',
  description: 'Could you tell me how to update the details on my account?',
};

const signup = (body: ReturnType<typeof owner>) => call(h, 'POST', '/signup', undefined, body);
const prefixOf = async (slug: string) =>
  (await h.db.workspace.findUniqueOrThrow({ where: { slug } })).ticketPrefix;

/** An author of the workspace, signed in the way the host hand-over signs them in. */
async function authorCookie(slug: string): Promise<string> {
  const ws = await h.db.workspace.findUniqueOrThrow({ where: { slug } });
  const user = await h.db.user.create({
    data: {
      workspaceId: ws.id,
      email: `author@${slug}.example`,
      name: 'Ann Author',
      role: 'AUTHOR',
    },
  });
  const author = await h.db.author.create({
    data: { workspaceId: ws.id, userId: user.id, externalId: `AUTH-${slug}` },
  });
  const token = await h.container.sessions.sign({
    userId: user.id,
    workspaceId: ws.id,
    role: 'AUTHOR',
    authorId: author.id,
    name: user.name,
    email: user.email,
  });
  return `bl_session=${token}`;
}

async function adminCookie(slug: string): Promise<string> {
  const user = await h.db.user.findFirstOrThrow({ where: { loginEmail: `owner@${slug}.example` } });
  const token = await h.container.sessions.sign({
    userId: user.id,
    workspaceId: user.workspaceId,
    role: 'ADMIN',
    authorId: null,
    name: user.name,
    email: user.email,
  });
  return `bl_session=${token}`;
}

async function raise(cookie: string) {
  const res = await createTicket(h, cookie, valid);
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string; number: string }>();
}

beforeAll(async () => {
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: String(ALL.length) } });
  for (const o of ALL) await deleteWorkspace(h.db, o.slug);
  for (const o of [QUILL, QUICK]) expect((await signup(o)).statusCode).toBe(201);
});
afterAll(async () => {
  for (const o of ALL) await deleteWorkspace(h.db, o.slug);
  await h.close();
});

describe('ticket prefixes', () => {
  it('gives every new workspace a fixed prefix from its name; alike names get BL, BL2…', async () => {
    expect(await prefixOf(QUILL.slug)).toBe('QW');
    expect(await prefixOf(QUICK.slug)).toBe('QW2');
    expect(await h.db.workspace.findUniqueOrThrow({ where: { slug: 'bookleaf' } })).toMatchObject({
      ticketPrefix: 'BL',
    });
  });

  it('never gives two concurrent signups the same prefix', async () => {
    const results = await Promise.all(RACERS.map(signup));
    expect(results.map((r) => r.statusCode)).toEqual(RACERS.map(() => 201));
    const prefixes = await Promise.all(RACERS.map((o) => prefixOf(o.slug)));
    expect([...prefixes].sort()).toEqual(['ZY', 'ZY2', 'ZY3', 'ZY4', 'ZY5']);
  });
});

describe('per-workspace ticket numbers', () => {
  let quillAuthor: string;
  let quickAuthor: string;

  beforeAll(async () => {
    [quillAuthor, quickAuthor] = await Promise.all([
      authorCookie(QUILL.slug),
      authorCookie(QUICK.slug),
    ]);
  });

  it('starts every workspace at 1001 under its own prefix', async () => {
    expect((await raise(quillAuthor)).number).toBe('QW-1001');
    expect((await raise(quickAuthor)).number).toBe('QW2-1001');
  });

  it('hands out 20 concurrent tickets without a duplicate or a gap', async () => {
    const tickets = await Promise.all(Array.from({ length: 20 }, () => raise(quillAuthor)));
    const numbers = tickets.map((t) => Number(t.number.replace('QW-', ''))).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => 1002 + i));
    const ws = await h.db.workspace.findUniqueOrThrow({ where: { slug: QUILL.slug } });
    expect(ws.nextTicketNumber).toBe(1022);
  });

  it("cannot find another workspace's ticket by id or by number (404 / no match)", async () => {
    const quickTicket = await raise(quickAuthor);
    const quillAdmin = await adminCookie(QUILL.slug);
    const byId = await call(h, 'GET', `/tickets/${quickTicket.id}`, quillAdmin);
    expect(byId.statusCode).toBe(404);
    const search = await call(h, 'GET', `/tickets?q=${quickTicket.number}`, quillAdmin);
    expect(search.statusCode).toBe(200);
    const ids = search.json<{ items: { id: string }[] }>().items.map((t) => t.id);
    expect(ids).not.toContain(quickTicket.id);
  });

  it('finds its own ticket by its label or bare number', async () => {
    const quickAdmin = await adminCookie(QUICK.slug);
    for (const q of ['QW2-1001', 'qw2-1001', '1001']) {
      const res = await call(h, 'GET', `/tickets?q=${q}`, quickAdmin);
      const items = res.json<{ items: { number: string }[] }>().items;
      expect(
        items.map((t) => t.number),
        q,
      ).toEqual(['QW2-1001']);
    }
  });
});
