import { randomInt } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RETENTION } from '../src/modules/retention/purge.js';
import { createRetention } from '../src/modules/retention/scheduler.js';
import { failInterruptedCalls } from '../src/modules/voice/repository.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import { asPlatform } from '../src/platform/tenancy.js';
import { createHarness, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let authorId: string;
const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms);
const silent = { info: () => undefined, error: () => undefined };

beforeAll(async () => {
  h = await createHarness();
  await h.login(EMAILS.arjun); // the author row is made on first sign-in
  authorId = (await h.db.author.findFirstOrThrow({ where: { user: { email: EMAILS.arjun } } })).id;
});
afterAll(() => h.close());

async function oldTicket(): Promise<string> {
  const t = await h.db.ticket.create({
    data: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      authorId,
      number: 800_000 + randomInt(100_000),
      subject: 'Retention test',
      description: 'A ticket that must outlive its bookkeeping rows.',
      slaDueAt: ago(0),
      createdAt: ago(200 * DAY),
    },
  });
  return t.id;
}

async function seedJobs(ticketId: string) {
  const job = (generation: number, status: 'SUCCEEDED' | 'FALLBACK' | 'QUEUED', age: number) => ({
    ticketId,
    kind: 'TRIAGE' as const,
    generation,
    status,
    createdAt: ago(age),
  });
  await h.db.aiJob.createMany({
    data: [
      job(1, 'SUCCEEDED', 40 * DAY), // old, superseded: deleted
      job(2, 'FALLBACK', 35 * DAY), // old, superseded: deleted
      job(3, 'QUEUED', 34 * DAY), // still to run: kept
      job(4, 'SUCCEEDED', 33 * DAY), // newest generation: kept (next one is "4 + 1")
    ],
  });
}

async function seedDeliveries() {
  const hook = await h.db.workspaceWebhook.create({
    data: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      url: 'https://hooks.retention.example',
      events: ['ticket.created'],
      secretEnc: 'x',
    },
  });
  const d = (status: 'SUCCEEDED' | 'FAILED' | 'PENDING', age: number) => ({
    webhookId: hook.id,
    event: 'ticket.created',
    payload: {},
    status,
    nextAttemptAt: ago(age),
    createdAt: ago(age),
  });
  await h.db.webhookDelivery.createMany({
    data: [
      d('SUCCEEDED', 31 * DAY),
      d('FAILED', 31 * DAY),
      d('PENDING', 31 * DAY),
      d('SUCCEEDED', DAY),
    ],
  });
  return hook.id;
}

async function seedRuns(ticketId: string, oldCount: number) {
  const run = (age: number) => ({
    ticketId,
    workspaceId: DEFAULT_WORKSPACE_ID,
    task: 'TRIAGE',
    provider: 'fake',
    model: 'fake',
    latencyMs: 1,
    outcome: 'OK' as const,
    createdAt: ago(age),
  });
  await h.db.aiRun.createMany({
    data: [...Array.from({ length: oldCount }, () => run(91 * DAY)), run(10 * DAY)],
  });
}

describe('retention pass', () => {
  it('deletes only old bookkeeping rows, in batches, and never the ticket', async () => {
    const ticketId = await oldTicket();
    await seedJobs(ticketId);
    const hookId = await seedDeliveries();
    const oldRuns = RETENTION.batch + 500; // more than one batch
    await seedRuns(ticketId, oldRuns);
    const audits = await h.db.auditEvent.count();

    const removed = await createRetention({
      db: h.container.db,
      clock: h.clock,
      log: silent,
    }).runOnce();

    const jobs = await h.db.aiJob.findMany({ where: { ticketId }, orderBy: { generation: 'asc' } });
    expect(jobs.map((j) => j.generation)).toEqual([3, 4]);
    const left = await h.db.webhookDelivery.findMany({ where: { webhookId: hookId } });
    expect(left.map((d) => d.status).sort()).toEqual(['PENDING', 'SUCCEEDED']);
    expect(await h.db.aiRun.count({ where: { ticketId } })).toBe(1);
    expect(removed.aiRuns).toBeGreaterThanOrEqual(oldRuns);
    expect(removed.aiJobs).toBeGreaterThanOrEqual(2);
    expect(removed.webhookDeliveries).toBeGreaterThanOrEqual(2);
    expect(await h.db.ticket.count({ where: { id: ticketId } })).toBe(1);
    expect(await h.db.auditEvent.count()).toBeGreaterThanOrEqual(audits);
    await h.db.workspaceWebhook.delete({ where: { id: hookId } });
  });
});

describe('voice calls on start-up', () => {
  it('fails only calls past the hard cap plus grace, leaving younger ones to their copy', async () => {
    const s = (status: 'PENDING' | 'ACTIVE', created: number, started: number | null) =>
      h.db.voiceSession.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          authorId,
          provider: 'fake',
          model: 'fake',
          maxSeconds: 300,
          status,
          createdAt: ago(created * 1000),
          startedAt: started === null ? null : ago(started * 1000),
        },
      });
    const young = [await s('PENDING', 10, null), await s('ACTIVE', 120, 100)];
    const old = [await s('PENDING', 400, null), await s('ACTIVE', 420, 400)];
    await asPlatform(() => failInterruptedCalls(h.container.db, new Date(), 300));
    const status = async (id: string) =>
      (await h.db.voiceSession.findUniqueOrThrow({ where: { id } })).status;
    for (const c of young) expect(await status(c.id)).toBe(c.status);
    for (const c of old) expect(await status(c.id)).toBe('FAILED');
    await h.db.voiceSession.deleteMany({
      where: { id: { in: [...young, ...old].map((c) => c.id) } },
    });
  });
});
