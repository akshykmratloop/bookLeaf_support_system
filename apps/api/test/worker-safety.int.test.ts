import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { HANDLERS, processJob, type JobHandlers } from '../src/ai/jobs/process.js';
import { finishJob, requeueJob } from '../src/ai/jobs/queue.js';
import type { ClaimedJob, JobDeps, JobKind } from '../src/ai/jobs/types.js';
import { createWorker } from '../src/ai/jobs/worker.js';
import { AiAuthError } from '../src/ai/providers/errors.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import { asPlatform } from '../src/platform/tenancy.js';
import { call, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let priya: string;
let admin: string;
const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const deps = (extra: Partial<JobDeps> = {}): JobDeps => ({
  db: h.db,
  ai: h.container.ai,
  clock: h.clock,
  events: h.container.events,
  records: h.container.records,
  log,
  ...extra,
});
const run = (job: ClaimedJob, d = deps(), handlers?: JobHandlers) =>
  asPlatform(() => processJob(job, d, handlers));

const newTicket = async () => {
  const res = await createTicket(h, priya, {
    bookId: null,
    subject: 'Worker safety',
    description: 'A question about my author account for the worker safety tests.',
  });
  return res.json<{ id: string }>().id;
};

/** Takes the ticket's newest job of a kind as if this worker had just claimed it. */
async function holdJob(ticketId: string, kind: JobKind, generation?: number): Promise<ClaimedJob> {
  const row = await h.db.aiJob.findFirstOrThrow({
    where: { ticketId, kind, ...(generation ? { generation } : {}) },
    orderBy: { generation: 'desc' },
  });
  const leaseExpiresAt = new Date(h.clock.now().getTime() + 90_000);
  const attempts = row.attempts + 1;
  await h.db.aiJob.update({
    where: { id: row.id },
    data: { status: 'RUNNING', attempts, leaseExpiresAt },
  });
  return { ...row, kind, attempts, leaseExpiresAt };
}
const jobRow = (id: string) => h.db.aiJob.findUniqueOrThrow({ where: { id } });

const brokenTriage = (fallback: () => Promise<void>): JobHandlers => ({
  ...HANDLERS,
  TRIAGE: {
    runAi: async () => {
      throw new AiAuthError('bad key');
    },
    fallback,
  },
});

beforeAll(async () => {
  h = await createHarness();
  [priya, admin] = await Promise.all([h.login(EMAILS.priya), h.login(EMAILS.admin)]);
  await h.drain();
});
afterAll(() => h.close());

describe('a job whose fallback throws (poison pill)', () => {
  it('ends FAILED with the error code, does not throw, and is never reclaimed', async () => {
    const job = await holdJob(await newTicket(), 'TRIAGE');
    const handlers = brokenTriage(async () => {
      throw new Error('fallback broke');
    });
    await expect(run(job, deps(), handlers)).resolves.toBeUndefined();
    expect(await jobRow(job.id)).toMatchObject({
      status: 'FAILED',
      lastErrorCode: 'AI_AUTH',
      leaseExpiresAt: null,
    });
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: job.id }),
      'ai job fallback failed; job is FAILED',
    );
    await h.drain();
    expect(await jobRow(job.id)).toMatchObject({ status: 'FAILED', attempts: job.attempts });
  });

  it('a crashed RUNNING job past its fallback attempt is not reclaimed; one with it left is', async () => {
    const past = await holdJob(await newTicket(), 'TRIAGE');
    const left = await holdJob(await newTicket(), 'TRIAGE');
    const expired = new Date(h.clock.now().getTime() - 1000);
    await h.db.aiJob.update({
      where: { id: past.id },
      data: { attempts: past.maxAttempts + 2, leaseExpiresAt: expired },
    });
    await h.db.aiJob.update({
      where: { id: left.id },
      data: { attempts: left.maxAttempts, leaseExpiresAt: expired },
    });
    await h.drain();
    expect(await jobRow(past.id)).toMatchObject({
      status: 'RUNNING',
      attempts: past.maxAttempts + 2,
    });
    expect(await jobRow(left.id)).toMatchObject({
      status: 'FALLBACK',
      lastErrorCode: 'ATTEMPTS_EXHAUSTED',
    });
    await h.db.aiJob.update({ where: { id: past.id }, data: { status: 'FAILED' } });
  });
});

describe('a worker that lost its lease', () => {
  it('cannot finish or requeue the job; the holder of the lease still can', async () => {
    const job = await holdJob(await newTicket(), 'TRIAGE');
    const stale = { ...job, leaseExpiresAt: new Date(job.leaseExpiresAt.getTime() - 5000) };
    const now = h.clock.now();
    expect(await finishJob(h.db, stale, { status: 'SUCCEEDED', now, errorCode: null })).toBe(false);
    expect(await requeueJob(h.db, stale, now, 'AI_UNAVAILABLE')).toBe(false);
    await run(stale);
    expect(await jobRow(job.id)).toMatchObject({
      status: 'RUNNING',
      leaseExpiresAt: job.leaseExpiresAt,
    });
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: job.id }),
      'ai job lease lost; outcome dropped',
    );
    expect(await finishJob(h.db, job, { status: 'SUCCEEDED', now, errorCode: null })).toBe(true);
    await h.drain();
  });
});

describe('a superseded job', () => {
  it('never calls the provider when a newer generation of its kind exists', async () => {
    const id = await newTicket();
    await h.drain();
    await call(h, 'POST', `/tickets/${id}/draft/regenerate`, admin);
    await call(h, 'POST', `/tickets/${id}/draft/regenerate`, admin);
    const job = await holdJob(id, 'DRAFT', 2);
    const before = h.aiCalls.length;
    await run(job);
    expect(h.aiCalls.length).toBe(before);
    expect(await jobRow(job.id)).toMatchObject({
      status: 'SUCCEEDED',
      lastErrorCode: 'SUPERSEDED',
    });
    await h.drain();
  });
});

describe('the daily AI budget per workspace (AI_TICKET_RUNS_PER_WORKSPACE_PER_DAY)', () => {
  it('at the cap a ticket job falls back with AI_BUDGET and makes no model call', async () => {
    await h.db.aiRun.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        task: 'TRIAGE',
        provider: 'anthropic',
        model: 'm',
        latencyMs: 1,
        outcome: 'OK',
      },
    });
    const job = await holdJob(await newTicket(), 'TRIAGE');
    const before = h.aiCalls.length;
    await run(job, deps({ ticketRunsPerWorkspacePerDay: 1 }));
    expect(h.aiCalls.length).toBe(before);
    expect(await jobRow(job.id)).toMatchObject({ status: 'FALLBACK', lastErrorCode: 'AI_BUDGET' });
    await h.drain();
  });
});

describe('WORKER_CONCURRENCY', () => {
  it('runs two jobs at the same time with concurrency 2, and stop() waits at most its timeout', async () => {
    await h.drain();
    const ids = [
      await holdJob(await newTicket(), 'TRIAGE'),
      await holdJob(await newTicket(), 'TRIAGE'),
    ];
    await h.db.aiJob.updateMany({
      where: { id: { in: ids.map((j) => j.id) } },
      data: { status: 'QUEUED', leaseExpiresAt: null },
    });
    let inFlight = 0;
    let most = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const handlers: JobHandlers = {
      ...HANDLERS,
      TRIAGE: {
        runAi: async () => {
          inFlight += 1;
          most = Math.max(most, inFlight);
          if (inFlight === 2) release();
          await gate;
        },
        fallback: async () => undefined,
      },
    };
    const worker = createWorker(deps(), { pollMs: 10, concurrency: 2, handlers });
    worker.start();
    await expect.poll(() => most, { timeout: 10_000 }).toBe(2);
    await expect
      .poll(
        async () =>
          h.db.aiJob.count({ where: { id: { in: ids.map((j) => j.id) }, status: 'SUCCEEDED' } }),
        { timeout: 10_000 },
      )
      .toBe(2);
    await worker.stop();
  });

  it('stop() gives up waiting for a hung job after its timeout', async () => {
    const job = await holdJob(await newTicket(), 'TRIAGE');
    await h.db.aiJob.update({
      where: { id: job.id },
      data: { status: 'QUEUED', leaseExpiresAt: null },
    });
    let release: () => void = () => undefined;
    const hung = new Promise<void>((resolve) => (release = resolve));
    let started = false;
    const handlers: JobHandlers = {
      ...HANDLERS,
      TRIAGE: { runAi: async () => ((started = true), hung), fallback: async () => undefined },
    };
    const worker = createWorker(deps(), {
      pollMs: 10,
      concurrency: 1,
      handlers,
      stopTimeoutMs: 100,
    });
    worker.start();
    await expect.poll(() => started, { timeout: 10_000 }).toBe(true);
    await worker.stop();
    expect(log.warn).toHaveBeenCalledWith({}, 'ai worker stopped with jobs still running');
    release();
    await expect
      .poll(async () => (await jobRow(job.id)).status, { timeout: 10_000 })
      .toBe('SUCCEEDED');
  });
});
