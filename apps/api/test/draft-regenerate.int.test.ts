import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let priya: string;
let admin: string;

beforeAll(async () => {
  h = await createHarness();
  [priya, admin] = await Promise.all([h.login(EMAILS.priya), h.login(EMAILS.admin)]);
  await h.drain();
});
afterAll(() => h.close());

describe('regenerating a draft', () => {
  it('two quick regenerates each queue their own generation (no unique-key clash)', async () => {
    const res = await createTicket(h, priya, {
      bookId: null,
      subject: 'Regenerate race',
      description: 'A question about my author account for the regenerate race test.',
    });
    const id = res.json<{ id: string }>().id;
    await h.drain();
    for (let round = 0; round < 3; round += 1) {
      const replies = await Promise.all([
        call(h, 'POST', `/tickets/${id}/draft/regenerate`, admin),
        call(h, 'POST', `/tickets/${id}/draft/regenerate`, admin),
      ]);
      expect(replies.map((r) => r.statusCode)).toEqual([202, 202]);
    }
    const jobs = await h.db.aiJob.findMany({
      where: { ticketId: id, kind: 'DRAFT' },
      orderBy: { generation: 'asc' },
    });
    expect(jobs.map((j) => j.generation)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    await h.drain();
  });
});

describe('an Idempotency-Key replay that loses the insert race', () => {
  it('still answers success: the clash is on client_request_id, so it is the replay', async () => {
    const res = await createTicket(h, priya, {
      bookId: null,
      subject: 'Replay race',
      description: 'A question about my author account for the replay race test.',
    });
    const id = res.json<{ id: string }>().id;
    const key = '0b6f3c1e-2d4a-4e5f-9a8b-7c6d5e4f3a2b';
    const send = () =>
      call(
        h,
        'POST',
        `/tickets/${id}/messages`,
        priya,
        { body: 'Any update on this, please?' },
        { 'idempotency-key': key },
      );
    const replies = await Promise.all([send(), send(), send()]);
    expect(replies.map((r) => r.statusCode)).toEqual([201, 201, 201]);
    expect(await h.db.ticketMessage.count({ where: { ticketId: id, kind: 'AUTHOR' } })).toBe(1);
    await h.drain();
  });
});
