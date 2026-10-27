import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookId, call, createHarness, createTicket, EMAILS, ORIGIN, type Harness } from './helpers/app.js';

let h: Harness;
let kavita: string;
let admin: string;

const valid = { subject: 'Book status question', description: 'Could you tell me where my book currently is in production?' };

beforeAll(async () => {
  h = await createHarness();
  [kavita, admin] = await Promise.all([h.login(EMAILS.kavita), h.login(EMAILS.admin)]);
});
afterAll(() => h.close());

interface Problem {
  code: string;
  errors?: { path: string; message: string }[];
}

describe('ticket creation', () => {
  it('creates the ticket, a SYSTEM acknowledgement and exactly one TRIAGE job', async () => {
    const res = await createTicket(h, kavita, { bookId: await bookId(h, 'BK015'), ...valid });
    expect(res.statusCode).toBe(201);
    const t = res.json<{ id: string; number: string; status: string; messages: { kind: string }[] }>();
    expect(t.status).toBe('OPEN');
    expect(t.number).toMatch(/^BL-\d+$/);
    expect(t.messages.map((m) => m.kind)).toEqual(['SYSTEM']);
    const jobs = await h.db.aiJob.findMany({ where: { ticketId: t.id } });
    expect(jobs.map((j) => [j.kind, j.generation, j.status])).toEqual([['TRIAGE', 1, 'QUEUED']]);
  });

  it('accepts a General / Account level ticket with no book', async () => {
    const res = await createTicket(h, kavita, { bookId: null, ...valid });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ book: unknown }>().book).toBeNull();
  });

  it('returns the first ticket for a repeated Idempotency-Key (no duplicate)', async () => {
    const key = randomUUID();
    const first = await createTicket(h, kavita, { bookId: null, ...valid }, key);
    const second = await createTicket(h, kavita, { bookId: null, ...valid }, key);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json<{ id: string }>().id).toBe(first.json<{ id: string }>().id);
    expect(await h.db.ticket.count({ where: { clientRequestId: key } })).toBe(1);
  });

  it('rejects a malformed Idempotency-Key (422)', async () => {
    const res = await createTicket(h, kavita, { bookId: null, ...valid }, 'not-a-uuid');
    expect(res.statusCode).toBe(422);
  });

  it('validates fields with field paths (422)', async () => {
    const short = await createTicket(h, kavita, { bookId: null, subject: 'Hi', description: valid.description });
    expect(short.statusCode).toBe(422);
    expect(short.json<Problem>().errors?.map((e) => e.path)).toContain('subject');
    const long = await createTicket(h, kavita, { bookId: null, subject: valid.subject, description: 'x'.repeat(4001) });
    expect(long.statusCode).toBe(422);
    expect(long.json<Problem>().errors?.map((e) => e.path)).toContain('description');
    const badBook = await createTicket(h, kavita, { bookId: 'not-a-uuid', ...valid });
    expect(badBook.statusCode).toBe(422);
  });

  it('strips HTML and counts length after cleaning', async () => {
    const res = await createTicket(h, kavita, { bookId: null, subject: '<b>Cover</b> approval', description: '<script>alert(1)</script>Please share the cover proofs for approval soon.' });
    expect(res.statusCode).toBe(201);
    const t = res.json<{ subject: string; description: string }>();
    expect(t.subject).toBe('Cover approval');
    expect(t.description).not.toMatch(/<|>/);
    const onlyHtml = await createTicket(h, kavita, { bookId: null, subject: '<i></i><b></b>', description: valid.description });
    expect(onlyHtml.statusCode).toBe(422);
  });
});

describe('CSRF and content type', () => {
  it('rejects a state-changing request from a foreign Origin (403)', async () => {
    const res = await call(h, 'POST', '/tickets', kavita, { bookId: null, ...valid }, { origin: 'https://evil.example' });
    expect(res.statusCode).toBe(403);
  });

  it('accepts the app\'s own Origin', async () => {
    const res = await call(h, 'POST', '/tickets', kavita, { bookId: null, ...valid }, { origin: ORIGIN });
    expect(res.statusCode).toBe(201);
  });

  it('rejects non-JSON bodies (415)', async () => {
    const res = await h.app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { cookie: kavita, 'content-type': 'text/plain' }, payload: 'subject=x' });
    expect(res.statusCode).toBe(415);
    const form = await h.app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { cookie: kavita, 'content-type': 'application/x-www-form-urlencoded' }, payload: 'subject=x' });
    expect(form.statusCode).toBe(415);
  });
});

describe('admin updates', () => {
  async function freshTicket(): Promise<{ id: string; version: number }> {
    const res = await createTicket(h, kavita, { bookId: null, ...valid });
    const id = res.json<{ id: string }>().id;
    const admView = await call(h, 'GET', `/tickets/${id}`, admin);
    return { id, version: admView.json<{ version: number }>().version };
  }

  it('assigns to self, then rejects a stale version (409)', async () => {
    const { id, version } = await freshTicket();
    const me = await call(h, 'GET', '/auth/me', admin);
    const myId = me.json<{ user: { id: string } }>().user.id;
    const ok = await call(h, 'PATCH', `/tickets/${id}`, admin, { version, assigneeId: myId });
    expect(ok.statusCode).toBe(200);
    expect(ok.json<{ assignee: { id: string } }>().assignee.id).toBe(myId);
    const stale = await call(h, 'PATCH', `/tickets/${id}`, admin, { version, status: 'IN_PROGRESS' });
    expect(stale.statusCode).toBe(409);
    expect(stale.json<Problem>().code).toBe('VERSION_CONFLICT');
  });

  it('refuses assigning a ticket to another admin (422)', async () => {
    const { id, version } = await freshTicket();
    const other = await h.db.user.findUniqueOrThrow({ where: { email: EMAILS.admin2 } });
    const res = await call(h, 'PATCH', `/tickets/${id}`, admin, { version, assigneeId: other.id });
    expect(res.statusCode).toBe(422);
  });

  it('refuses an invalid status transition (CLOSED → RESOLVED is 409)', async () => {
    const { id, version } = await freshTicket();
    const closed = await call(h, 'PATCH', `/tickets/${id}`, admin, { version, status: 'CLOSED' });
    expect(closed.statusCode).toBe(200);
    const res = await call(h, 'PATCH', `/tickets/${id}`, admin, { version: closed.json<{ version: number }>().version, status: 'RESOLVED' });
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('INVALID_TRANSITION');
  });

  it('records an audit event for each admin change', async () => {
    const { id, version } = await freshTicket();
    await call(h, 'PATCH', `/tickets/${id}`, admin, { version, priority: 'CRITICAL' });
    const audit = await h.db.auditEvent.findMany({ where: { entityId: id, action: 'ticket.updated' } });
    expect(audit).toHaveLength(1);
  });

  it('rejects an empty update (422) and an unknown ticket (404)', async () => {
    const { id, version } = await freshTicket();
    expect((await call(h, 'PATCH', `/tickets/${id}`, admin, { version })).statusCode).toBe(422);
    expect((await call(h, 'GET', `/tickets/${randomUUID()}`, admin)).statusCode).toBe(404);
    expect((await call(h, 'GET', '/tickets/not-a-uuid', admin)).statusCode).toBe(422);
  });
});

describe('admin queue', () => {
  it('paginates with a cursor', async () => {
    const first = await call(h, 'GET', '/tickets?limit=1', admin);
    const p1 = first.json<{ items: { id: string }[]; nextCursor: string | null }>();
    expect(p1.items).toHaveLength(1);
    expect(p1.nextCursor).not.toBeNull();
    const second = await call(h, 'GET', `/tickets?limit=1&cursor=${p1.nextCursor}`, admin);
    const p2 = second.json<{ items: { id: string }[] }>();
    expect(p2.items).toHaveLength(1);
    expect(p2.items[0]?.id).not.toBe(p1.items[0]?.id);
  });

  it('rejects limits above 200 and filters by status', async () => {
    expect((await call(h, 'GET', '/tickets?limit=201', admin)).statusCode).toBe(422);
    const res = await call(h, 'GET', '/tickets?status=CLOSED', admin);
    expect(res.json<{ items: { status: string }[] }>().items.every((t) => t.status === 'CLOSED')).toBe(true);
  });
});
