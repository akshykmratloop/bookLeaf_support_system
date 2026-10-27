import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookId, call, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let priya: string;
let rohit: string;
let admin: string;
let priyaTicket: string;

beforeAll(async () => {
  h = await createHarness();
  [priya, rohit, admin] = await Promise.all([
    h.login(EMAILS.priya),
    h.login(EMAILS.rohit),
    h.login(EMAILS.admin),
  ]);
  const res = await createTicket(h, priya, {
    bookId: await bookId(h, 'BK001'),
    subject: 'Royalty question',
    description: 'When will I receive my pending royalty payment for this book?',
  });
  priyaTicket = res.json<{ id: string }>().id;
  await h.drain();
  await call(h, 'POST', `/tickets/${priyaTicket}/messages`, admin, {
    body: 'SECRET-NOTE: author was rude on phone',
    kind: 'INTERNAL_NOTE',
  });
});
afterAll(() => h.close());

describe('authentication', () => {
  it('rejects requests without a session (401) and with a forged cookie (401)', async () => {
    expect((await call(h, 'GET', '/tickets')).statusCode).toBe(401);
    expect((await call(h, 'GET', '/books', 'bl_session=not-a-jwt')).statusCode).toBe(401);
    expect((await call(h, 'GET', '/auth/me')).statusCode).toBe(401);
  });

  it('rejects wrong passwords with a generic message', async () => {
    const res = await call(h, 'POST', '/auth/login', undefined, {
      email: EMAILS.priya,
      password: 'wrong-password',
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ title: string }>().title).toBe('Invalid email or password');
  });
});

describe('author isolation', () => {
  it('returns 404 when another author reads or writes a ticket', async () => {
    expect((await call(h, 'GET', `/tickets/${priyaTicket}`, rohit)).statusCode).toBe(404);
    expect(
      (await call(h, 'POST', `/tickets/${priyaTicket}/messages`, rohit, { body: 'hello' }))
        .statusCode,
    ).toBe(404);
    const list = await call(h, 'GET', '/tickets', rohit);
    expect(list.json<{ items: { id: string }[] }>().items.map((t) => t.id)).not.toContain(
      priyaTicket,
    );
  });

  it("lists only the author's own books and hides other authors' books by id", async () => {
    const res = await call(h, 'GET', '/books', priya);
    expect(
      res
        .json<{ items: { externalId: string }[] }>()
        .items.map((b) => b.externalId)
        .sort(),
    ).toEqual(['BK001', 'BK002']);
    expect((await call(h, 'GET', `/books/${await bookId(h, 'BK003')}`, priya)).statusCode).toBe(
      404,
    );
  });

  it("refuses a ticket about another author's book (404)", async () => {
    const res = await createTicket(h, priya, {
      bookId: await bookId(h, 'BK003'),
      subject: 'Not my book',
      description: 'This is a ticket about a book that is not mine at all.',
    });
    expect(res.statusCode).toBe(404);
  });

  it('never shows internal notes or AI fields to the author', async () => {
    const res = await call(h, 'GET', `/tickets/${priyaTicket}`, priya);
    expect(res.statusCode).toBe(200);
    const raw = res.body;
    expect(raw).not.toContain('SECRET-NOTE');
    const body = res.json<Record<string, unknown>>();
    for (const field of [
      'category',
      'priority',
      'aiJobs',
      'aiState',
      'priorityReasons',
      'needsReview',
      'assignee',
      'version',
    ]) {
      expect(body).not.toHaveProperty(field);
    }
    const list = await call(h, 'GET', '/tickets', priya);
    expect(list.body).not.toMatch(/"category"|"priority"|"aiState"/);
  });
});

describe('role checks', () => {
  it('forbids authors from admin routes (403)', async () => {
    expect(
      (await call(h, 'PATCH', `/tickets/${priyaTicket}`, priya, { version: 0, status: 'CLOSED' }))
        .statusCode,
    ).toBe(403);
    expect((await call(h, 'GET', `/tickets/${priyaTicket}/draft`, priya)).statusCode).toBe(403);
    expect(
      (await call(h, 'POST', `/tickets/${priyaTicket}/draft/regenerate`, priya)).statusCode,
    ).toBe(403);
    expect(
      (await call(h, 'POST', `/tickets/${priyaTicket}/check`, priya, { body: 'x' })).statusCode,
    ).toBe(403);
    expect((await call(h, 'POST', `/tickets/${priyaTicket}/ai/retry`, priya)).statusCode).toBe(403);
    expect((await call(h, 'GET', '/admin/ai/status', priya)).statusCode).toBe(403);
    expect(
      (await call(h, 'PUT', '/admin/ai/settings', priya, { version: 0, simulateOutage: true }))
        .statusCode,
    ).toBe(403);
    expect((await call(h, 'POST', '/admin/ai/test', priya)).statusCode).toBe(403);
  });

  it('forbids admins from raising tickets as an author (403)', async () => {
    const res = await createTicket(h, admin, {
      bookId: null,
      subject: 'Admin ticket',
      description: 'Admins should not be able to create author tickets.',
    });
    expect(res.statusCode).toBe(403);
  });

  it("lets admins see every author's ticket with AI fields", async () => {
    const res = await call(h, 'GET', `/tickets/${priyaTicket}`, admin);
    expect(res.statusCode).toBe(200);
    expect(
      res.json<{ category: string; messages: { kind: string }[] }>().messages.map((m) => m.kind),
    ).toContain('INTERNAL_NOTE');
  });
});
