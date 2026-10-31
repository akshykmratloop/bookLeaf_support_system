import { asPlatform } from '../../platform/tenancy.js';
import { assertLeaseCoversCalls, DEFAULT_LEASE_MS } from './lease.js';
import { HANDLERS, processJob, type JobHandlers } from './process.js';
import { claimNextJob } from './queue.js';
import type { JobDeps } from './types.js';

export { processJob } from './process.js';

const DEFAULT_CONCURRENCY = 2;
const STOP_TIMEOUT_MS = 15_000;

export interface WorkerOptions {
  pollMs: number;
  leaseMs?: number;
  /** Claim loops run side by side (WORKER_CONCURRENCY). */
  concurrency?: number;
  /** The host records timeout (HOST_TIMEOUT_MS): a job's lease must outlast it plus the model call. */
  hostTimeoutMs?: number;
  /** Longest stop() waits for running jobs. */
  stopTimeoutMs?: number;
  /** Tests swap the handlers; production uses the triage and draft handlers. */
  handlers?: JobHandlers;
}

export interface Worker {
  start(): void;
  /** Stops claiming and waits for running jobs, at most stopTimeoutMs. */
  stop(): Promise<void>;
  /** Processes at most one job. Returns false when nothing was runnable. */
  runOnce(): Promise<boolean>;
}

/** Sleeps that stop() can cut short, so a stopping worker does not wait out its poll interval. */
function wakeableSleeps() {
  const waking = new Set<() => void>();
  return {
    sleep: (ms: number) =>
      new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          waking.delete(done);
          resolve();
        };
        const timer = setTimeout(done, ms);
        waking.add(done);
      }),
    wakeAll: () => [...waking].forEach((done) => done()),
  };
}

/** Resolves when the work settles or the timeout passes; true when it timed out. */
async function settleWithin(work: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), ms);
  });
  const timedOut = await Promise.race([work.then(() => false), timeout]);
  clearTimeout(timer);
  return timedOut;
}

/** Claims and runs one job of any workspace: the platform (owner) path (S.8). */
const claimAndRun = (deps: JobDeps, leaseMs: number, handlers: JobHandlers) => () =>
  asPlatform(async () => {
    const job = await claimNextJob(deps.db, deps.clock.now(), leaseMs);
    if (!job) return false;
    await processJob(job, deps, handlers);
    return true;
  });

export function createWorker(deps: JobDeps, opts: WorkerOptions): Worker {
  const leaseMs = opts.leaseMs ?? DEFAULT_LEASE_MS;
  assertLeaseCoversCalls(leaseMs, opts.hostTimeoutMs ?? 0);
  const handlers = opts.handlers ?? HANDLERS;
  const { sleep, wakeAll } = wakeableSleeps();
  let running = false;
  let loops: Promise<void>[] = [];
  const runOnce = claimAndRun(deps, leaseMs, handlers);
  const loop = async () => {
    while (running) {
      const worked = await runOnce().catch((err: unknown) => {
        deps.log.error({ err }, 'ai worker poll failed');
        return false;
      });
      if (!worked && running) await sleep(opts.pollMs);
    }
  };
  return {
    start() {
      if (running) return;
      running = true;
      loops = Array.from({ length: opts.concurrency ?? DEFAULT_CONCURRENCY }, loop);
    },
    async stop() {
      running = false;
      wakeAll();
      const timedOut = await settleWithin(
        Promise.all(loops),
        opts.stopTimeoutMs ?? STOP_TIMEOUT_MS,
      );
      if (timedOut) deps.log.warn({}, 'ai worker stopped with jobs still running');
    },
    runOnce,
  };
}
