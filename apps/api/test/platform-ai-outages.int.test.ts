import type { PlatformAiStatus } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';
import { platformCookie, seedSuperAdmin } from './helpers/platform.js';

/** The console's AI screen shows when AI quietly stopped working (H-AI). */
let h: Harness;
let platform: string;
let priya: string;

const status = async () =>
  (await call(h, 'GET', '/platform/ai', platform)).json<PlatformAiStatus>();

async function jobFor(change: {
  status: 'FALLBACK' | 'FAILED' | 'SUCCEEDED';
  code: string | null;
  minutesAgo: number;
}) {
  const res = await createTicket(h, priya, {
    bookId: null,
    subject: 'Outage counts',
    description: 'A question about my author account for the outage count test.',
  });
  const ticketId = res.json<{ id: string }>().id;
  const finishedAt = new Date(h.clock.now().getTime() - change.minutesAgo * 60_000);
  await h.db.aiJob.updateMany({
    where: { ticketId },
    data: { status: change.status, lastErrorCode: change.code, finishedAt },
  });
}

beforeAll(async () => {
  h = await createHarness();
  await seedSuperAdmin(h);
  platform = await platformCookie(h);
  priya = await h.login(EMAILS.priya);
  await h.drain();
  await h.db.aiJob.updateMany({ data: { finishedAt: new Date(0) } });
});
afterAll(() => h.close());

describe('AI outages in the last hour', () => {
  it('counts jobs that fell back or failed, and how many were a key or setup problem', async () => {
    await jobFor({ status: 'FALLBACK', code: 'AI_AUTH', minutesAgo: 5 });
    await jobFor({ status: 'FALLBACK', code: 'AI_UNAVAILABLE', minutesAgo: 10 });
    await jobFor({ status: 'FAILED', code: 'AI_NOT_CONFIGURED', minutesAgo: 20 });
    await jobFor({ status: 'SUCCEEDED', code: null, minutesAgo: 1 });
    await jobFor({ status: 'FALLBACK', code: 'AI_AUTH', minutesAgo: 90 });
    expect((await status()).recentJobs).toEqual({
      windowMinutes: 60,
      fallback: 2,
      failed: 1,
      authOrNotConfigured: 2,
    });
  });
});
