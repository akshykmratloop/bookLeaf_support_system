import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminTicket } from '@bookleaf/shared';
import { call, createHarness, EMAILS, type Harness } from './helpers/app.js';
import { asServer, mintKey, SERVER_TICKET } from './helpers/server-api.js';

/**
 * U-11 + U-2: the product's server writes as the customer, so a solved or closed ticket is locked
 * for its messages too (409 TICKET_SOLVED), and the ticket says so in `canReply`. Reopening, by
 * the server API (PATCH) or by staff, lets the customer write again.
 */
let h: Harness;
let admin: string;
let key: string;

interface Detail {
  id: string;
  status: string;
  canReply: boolean;
}

const newTicket = async () =>
  (
    await asServer(h, 'POST', '/server/tickets', { key, body: SERVER_TICKET, idem: true })
  ).json<Detail>();
const say = (id: string, body = 'One more detail about my statement.') =>
  asServer(h, 'POST', `/server/tickets/${id}/messages`, { key, body: { body }, idem: true });
const move = (id: string, status: string) =>
  asServer(h, 'PATCH', `/server/tickets/${id}`, { key, body: { status }, idem: true });
const authorMessages = (ticketId: string) =>
  h.db.ticketMessage.count({ where: { ticketId, kind: 'AUTHOR' } });

beforeAll(async () => {
  h = await createHarness();
  admin = await h.login(EMAILS.admin);
  key = (await mintKey(h, admin, ['tickets:read', 'tickets:write'])).plainKey;
});
afterAll(async () => {
  await h.close();
});

describe('server API follows the solved-ticket lock (U-2)', () => {
  it('an open ticket can take a customer message', async () => {
    const t = await newTicket();
    expect(t.canReply).toBe(true);
    expect((await say(t.id)).statusCode).toBe(201);
  });

  it.each(['RESOLVED', 'CLOSED'])('a %s ticket refuses customer messages with 409', async (to) => {
    const t = await newTicket();
    const moved = await move(t.id, to);
    expect(moved.json<Detail>()).toMatchObject({ status: to, canReply: false });
    const before = await authorMessages(t.id);
    const res = await say(t.id);
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('TICKET_SOLVED');
    expect(await authorMessages(t.id)).toBe(before);
    const read = await asServer(h, 'GET', `/server/tickets/${t.id}`, { key });
    expect(read.json<Detail>()).toMatchObject({ status: to, canReply: false });
  });

  it('a server reopen lets the customer write again', async () => {
    const t = await newTicket();
    await move(t.id, 'RESOLVED');
    const reopened = await move(t.id, 'OPEN');
    expect(reopened.json<Detail>()).toMatchObject({ status: 'OPEN', canReply: true });
    expect((await say(t.id)).statusCode).toBe(201);
  });

  it('a staff reopen lets the customer write again', async () => {
    const t = await newTicket();
    await move(t.id, 'RESOLVED');
    const { version } = (await call(h, 'GET', `/tickets/${t.id}`, admin)).json<AdminTicket>();
    const staff = await call(h, 'PATCH', `/tickets/${t.id}`, admin, { status: 'OPEN', version });
    expect(staff.statusCode).toBe(200);
    expect((await say(t.id)).statusCode).toBe(201);
  });
});
