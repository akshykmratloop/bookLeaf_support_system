import { AiError, AiRateLimitedError } from '../providers/errors.js';
import { draftHandler } from './handlers/draft.js';
import { triageHandler } from './handlers/triage.js';
import { claimNextJob, finishJob, requeueJob } from './queue.js';
import type { ClaimedJob, JobDeps, JobHandler, JobKind } from './types.js';

const HANDLERS: Record<JobKind, JobHandler> = { TRIAGE: triageHandler, DRAFT: draftHandler };
const BACKOFF_MS = [5_000, 30_000, 120_000] as const;
const DEFAULT_LEASE_MS = 90_000;

export interface WorkerOptions {
  pollMs: number;
  leaseMs?: number;
}

function errorCodeOf(err: unknown): string {
  return err instanceof AiError ? err.code : 'INTERNAL';
}

function retryDelay(err: unknown, attempts: number): number {
  const base = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[0];
  return err instanceof AiRateLimitedError && err.retryAfterMs
    ? Math.max(base, err.retryAfterMs)
    : base;
}

async function applyFallback(job: ClaimedJob, deps: JobDeps, code: string): Promise<void> {
  await HANDLERS[job.kind].fallback(job, deps);
  await finishJob(deps.db, job, 'FALLBACK', deps.clock.now(), code);
  deps.log.warn(
    { jobId: job.id, ticketId: job.ticketId, kind: job.kind, code },
    'ai job fell back to rules',
  );
}

/** Runs one job end to end. Transient errors retry with backoff; the rest fall back immediately. */
export async function processJob(job: ClaimedJob, deps: JobDeps): Promise<void> {
  const ctx = { jobId: job.id, ticketId: job.ticketId, kind: job.kind, attempt: job.attempts };
  if (job.attempts > job.maxAttempts) return applyFallback(job, deps, 'ATTEMPTS_EXHAUSTED');
  try {
    await HANDLERS[job.kind].runAi(job, deps);
    await finishJob(deps.db, job, 'SUCCEEDED', deps.clock.now(), null);
  } catch (err) {
    const code = errorCodeOf(err);
    const retryable = err instanceof AiError ? err.retryable : true;
    if (!(err instanceof AiError)) deps.log.error({ ...ctx, err }, 'ai job failed unexpectedly');
    if (retryable && job.attempts < job.maxAttempts) {
      const runAfter = new Date(deps.clock.now().getTime() + retryDelay(err, job.attempts));
      await requeueJob(deps.db, job, runAfter, code);
      deps.log.warn({ ...ctx, code, runAfter }, 'ai job will retry');
      return;
    }
    await applyFallback(job, deps, code);
  }
}

export interface Worker {
  start(): void;
  stop(): Promise<void>;
  /** Processes at most one job. Returns false when nothing was runnable. */
  runOnce(): Promise<boolean>;
}

export function createWorker(deps: JobDeps, opts: WorkerOptions): Worker {
  const leaseMs = opts.leaseMs ?? DEFAULT_LEASE_MS;
  let running = false;
  let loop: Promise<void> | null = null;
  const runOnce = async () => {
    const job = await claimNextJob(deps.db, deps.clock.now(), leaseMs);
    if (!job) return false;
    await processJob(job, deps);
    return true;
  };
  const tick = async () => {
    while (running) {
      const worked = await runOnce().catch((err: unknown) => {
        deps.log.error({ err }, 'ai worker poll failed');
        return false;
      });
      if (!worked) await new Promise((r) => setTimeout(r, opts.pollMs));
    }
  };
  return {
    start() {
      if (running) return;
      running = true;
      loop = tick();
    },
    async stop() {
      running = false;
      await loop;
    },
    runOnce,
  };
}
