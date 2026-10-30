import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminTicket, AdminTicketListItem, AuthorTicket } from '@bookleaf/shared';
import { recordReply } from '../src/modules/messages/record-reply.js';
import { call, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';

/**
 * U-2: once the author marks a ticket solved it is Resolved for everyone (queue, detail, live
 * stream) and locked for the author; only staff can open it again.
 */
let h: Harness;
let base: string;
let priya: string;
let admin: string;

const REPLY =
  'Hi Priya, thank you for writing in. Our team is checking this and will update you here. Warm regards, BookLeaf Author Support';

async function newTicket(): Promise<string> {
  const res = await createTicket(h, priya, {
    bookId: null,
    subject: 'Solved lock test',
    description: 'My royalty statement for this quarter looks lower than my sales.',
  });
  expect(res.statusCode).toBe(201);
  return res.json<AuthorTicket>().id;
}

const solve = (id: string) => call(h, 'POST', `/tickets/${id}/solve`, priya, {});
const authorSays = (id: string, body: string) =>
  call(h, 'POST', `/tickets/${id}/messages`, priya, { body });
const adminView = async (id: string) =>
  (await call(h, 'GET', `/tickets/${id}`, admin)).json<AdminTicket>();
const queueRow = async (id: string) =>
  (await call(h, 'GET', '/tickets?limit=200', admin))
    .json<{ items: AdminTicketListItem[] }>()
    .items.find((t) => t.id === id);
const setStatus = async (id: string, status: AdminTicket['status']) => {
  const { version } = await adminView(id);
  return call(h, 'PATCH', `/tickets/${id}`, admin, { status, version });
};

/** Opens /events over real HTTP and collects the `ticket` events it receives. */
async function listen(cookie: string) {
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/v1/events`, { headers: { cookie }, signal: ctrl.signal });
  const events: { type: string; ticketId: string }[] = [];
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  void (async () => {
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: '', done: true }));
      if (done) return;
      buf += value;
      for (const m of buf.matchAll(/event: ticket\ndata: (.+)\n\n/g))
        events.push(JSON.parse(m[1]!));
      buf = buf.slice(buf.lastIndexOf('\n\n') + 2);
    }
  })();
  return { events, close: () => ctrl.abort() };
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 50 && !check(); i += 1) await new Promise((r) => setTimeout(r, 40));
};

beforeAll(async () => {
  h = await createHarness();
  await h.app.listen({ port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${(h.app.server.address() as AddressInfo).port}`;
  [priya, admin] = await Promise.all([h.login(EMAILS.priya), h.login(EMAILS.admin)]);
});
afterAll(() => h.close());

describe('the author marks a ticket solved', () => {
  it('shows Resolved in the staff queue and detail, and tells staff live', async () => {
    const id = await newTicket();
    await call(h, 'POST', `/tickets/${id}/messages`, admin, { body: REPLY });
    const staff = await listen(admin);
    expect((await solve(id)).statusCode).toBe(200);
    await until(() => staff.events.some((e) => e.type === 'ticket.status_changed'));
    staff.close();
    expect(staff.events).toContainEqual({ type: 'ticket.status_changed', ticketId: id });
    expect((await adminView(id)).status).toBe('RESOLVED');
    expect((await queueRow(id))?.status).toBe('RESOLVED');
  });

  it('stays Resolved when a staff reply read the ticket just before the author solved it', async () => {
    const id = await newTicket();
    const before = await h.db.ticket.findUniqueOrThrow({ where: { id } });
    expect((await solve(id)).statusCode).toBe(200);
    const now = h.clock.now();
    await h.db.$transaction(async (tx) => {
      const sent = await tx.ticketMessage.create({
        data: { ticketId: id, kind: 'REPLY', body: REPLY, createdAt: now },
      });
      await recordReply(tx, { ticket: before, now, messageId: sent.id, audit: null });
    });
    const after = await adminView(id);
    expect(after.status).toBe('RESOLVED');
    expect(after.firstResponseAt).not.toBeNull();
  });

  it('stays Resolved when AI work queued before the solve finishes afterwards', async () => {
    const id = await newTicket();
    expect((await solve(id)).statusCode).toBe(200);
    await h.drain();
    expect((await adminView(id)).status).toBe('RESOLVED');
  });
});

describe('a solved ticket is locked for the author', () => {
  it('refuses an author message on a Resolved ticket (409) and keeps it Resolved', async () => {
    const id = await newTicket();
    await solve(id);
    const res = await authorSays(id, 'Actually, one more question.');
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('TICKET_SOLVED');
    const t = await adminView(id);
    expect(t.status).toBe('RESOLVED');
    expect(t.messages.filter((m) => m.kind === 'AUTHOR')).toEqual([]);
  });

  it('refuses an author message on a ticket staff closed (409)', async () => {
    const id = await newTicket();
    expect((await setStatus(id, 'CLOSED')).statusCode).toBe(200);
    expect((await authorSays(id, 'Hello again?')).statusCode).toBe(409);
    expect((await adminView(id)).status).toBe('CLOSED');
  });

  it('tells the author the ticket is locked (canReply false)', async () => {
    const id = await newTicket();
    const open = (await call(h, 'GET', `/tickets/${id}`, priya)).json<AuthorTicket>();
    expect(open.canReply).toBe(true);
    await solve(id);
    const solved = (await call(h, 'GET', `/tickets/${id}`, priya)).json<AuthorTicket>();
    expect(solved).toMatchObject({ status: 'RESOLVED', canSolve: false, canReply: false });
  });

  it('staff can still reply and reopen; then the author can write again', async () => {
    const id = await newTicket();
    await solve(id);
    const reply = await call(h, 'POST', `/tickets/${id}/messages`, admin, { body: REPLY });
    expect(reply.statusCode).toBe(201);
    expect((await setStatus(id, 'OPEN')).statusCode).toBe(200);
    expect((await authorSays(id, 'Thanks, one more detail.')).statusCode).toBe(201);
    expect((await adminView(id)).status).toBe('OPEN');
  });
});
