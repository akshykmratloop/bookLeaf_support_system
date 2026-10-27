import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookId, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;

beforeAll(async () => {
  h = await createHarness({ env: { WORKER_ENABLED: 'true', WORKER_POLL_MS: '100' } });
});
afterAll(() => h.close());

describe('background work inside supportPlugin', () => {
  it('runs by itself: a host that only mounts the plugin still gets tickets triaged and drafted', async () => {
    const cookie = await h.login(EMAILS.priya);
    const res = await createTicket(h, cookie, {
      bookId: await bookId(h, 'BK001'),
      subject: 'Royalty payout',
      description: 'My royalty payout has not arrived yet for my book, please check.',
    });
    const { id } = res.json<{ id: string }>();
    const aiState = async () => (await h.db.ticket.findUniqueOrThrow({ where: { id } })).aiState;
    await expect.poll(aiState, { timeout: 5000, interval: 50 }).toBe('DONE');
  });
});
