import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookId, call, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let priya: string;
let admin: string;

interface CheckProblem {
  code: string;
  details: { issues: { code: string; overridable: boolean }[]; placeholders: string[] };
}

async function newTicket(): Promise<string> {
  const res = await createTicket(h, priya, {
    bookId: await bookId(h, 'BK001'),
    subject: 'Royalty question',
    description: 'When will my pending royalty for this book be paid out to me?',
  });
  await h.drain();
  return res.json<{ id: string }>().id;
}

const reply = (id: string, body: string, extra: Record<string, unknown> = {}) =>
  call(h, 'POST', `/tickets/${id}/messages`, admin, { body, ...extra });

beforeAll(async () => {
  h = await createHarness();
  [priya, admin] = await Promise.all([h.login(EMAILS.priya), h.login(EMAILS.admin)]);
});
afterAll(() => h.close());

describe('reply gate (checker at send time)', () => {
  it('blocks an invented amount with the issue list (422 CHECK_FAILED)', async () => {
    const id = await newTicket();
    const res = await reply(
      id,
      'Hi Priya, your royalty of ₹12,345 is on its way to your account. Warm regards, BookLeaf Author Support',
    );
    expect(res.statusCode).toBe(422);
    const p = res.json<CheckProblem>();
    expect(p.code).toBe('CHECK_FAILED');
    expect(p.details.issues.map((i) => i.code)).toContain('UNSUPPORTED_AMOUNT');
    const author = await call(h, 'GET', `/tickets/${id}`, priya);
    expect(author.body).not.toContain('12,345');
  });

  it('sends with a written override reason and records it in the audit log', async () => {
    const id = await newTicket();
    const res = await reply(
      id,
      'Hi Priya, your royalty of ₹12,345 is on its way to your account. Warm regards, BookLeaf Author Support',
      { overrideReason: 'Confirmed with finance team today' },
    );
    expect(res.statusCode).toBe(201);
    const audit = await h.db.auditEvent.findMany({
      where: { entityId: id, action: 'reply.check_override' },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.reason).toBe('Confirmed with finance team today');
  });

  it('never sends a reply with an unfilled placeholder, even with an override reason', async () => {
    const id = await newTicket();
    const res = await reply(
      id,
      'Hi Priya, your bank account is [CONFIRM: bank linked?]. Warm regards, BookLeaf Author Support',
      { overrideReason: 'I really want to send this' },
    );
    expect(res.statusCode).toBe(422);
    expect(res.json<CheckProblem>().details.placeholders).toEqual(['[CONFIRM: bank linked?]']);
    expect(await h.db.ticketMessage.count({ where: { ticketId: id, kind: 'REPLY' } })).toBe(0);
  });

  it('sends a grounded reply: author sees it, first response is recorded, status moves to In Progress', async () => {
    const id = await newTicket();
    const res = await reply(
      id,
      'Hi Priya, thank you for your patience. You have ₹3,570 pending, which will be paid in the cycle that closes by 14 Feb 2026. Warm regards, BookLeaf Author Support',
    );
    expect(res.statusCode).toBe(201);
    const t = await h.db.ticket.findUniqueOrThrow({ where: { id } });
    expect(t.status).toBe('IN_PROGRESS');
    expect(t.firstResponseAt).not.toBeNull();
    const author = await call(h, 'GET', `/tickets/${id}`, priya);
    const replies = author
      .json<{ messages: { kind: string; senderName: string }[] }>()
      .messages.filter((m) => m.kind === 'REPLY');
    expect(replies).toHaveLength(1);
    expect(replies[0]?.senderName).toBe('BookLeaf Support');
  });

  it('internal notes skip the checker and stay hidden from the author', async () => {
    const id = await newTicket();
    const res = await reply(id, 'Finance says ₹99,999 is stuck; do not tell the author yet.', {
      kind: 'INTERNAL_NOTE',
    });
    expect(res.statusCode).toBe(201);
    const author = await call(h, 'GET', `/tickets/${id}`, priya);
    expect(author.body).not.toContain('99,999');
  });

  it('POST /check returns the same verdict without sending anything', async () => {
    const id = await newTicket();
    const res = await call(h, 'POST', `/tickets/${id}/check`, admin, {
      body: 'Hi Priya, you will get ₹50,000. We guarantee it.',
    });
    expect(res.statusCode).toBe(200);
    const codes = res
      .json<{ passed: boolean; issues: { code: string }[] }>()
      .issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['UNSUPPORTED_AMOUNT', 'GUARANTEE']));
    expect(await h.db.ticketMessage.count({ where: { ticketId: id, kind: 'REPLY' } })).toBe(0);
  });

  it('a repeated Idempotency-Key does not send the reply twice', async () => {
    const id = await newTicket();
    const key = '0b6f6c3e-5f1a-4d0a-9a51-8f1c2d3e4f50';
    const body =
      'Hi Priya, thank you for your patience. Our team will get back to you within 48 hours. Warm regards, BookLeaf Author Support';
    await call(h, 'POST', `/tickets/${id}/messages`, admin, { body }, { 'idempotency-key': key });
    await call(h, 'POST', `/tickets/${id}/messages`, admin, { body }, { 'idempotency-key': key });
    expect(await h.db.ticketMessage.count({ where: { ticketId: id, kind: 'REPLY' } })).toBe(1);
  });
});
