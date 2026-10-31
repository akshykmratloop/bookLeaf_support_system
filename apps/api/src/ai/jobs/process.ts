import { AiError, AiRateLimitedError } from '../providers/errors.js';
import { draftHandler } from './handlers/draft.js';
import { triageHandler } from './handlers/triage.js';
import { finishJob, isLatestGeneration, requeueJob, type JobOutcome } from './queue.js';
import type { ClaimedJob, JobDeps, JobHandler, JobKind } from './types.js';

export type JobHandlers = Record<JobKind, JobHandler>;

export const HANDLERS: JobHandlers = { TRIAGE: triageHandler, DRAFT: draftHandler };
const BACKOFF_MS = [5_000, 30_000, 120_000] as const;

const errorCodeOf = (err: unknown): string => (err instanceof AiError ? err.code : 'INTERNAL');
const logContext = (job: ClaimedJob) => ({
  jobId: job.id,
  ticketId: job.ticketId,
  kind: job.kind,
  attempt: job.attempts,
});

function retryDelay(err: unknown, attempts: number): number {
  const base = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[0];
  return err instanceof AiRateLimitedError && err.retryAfterMs
    ? Math.max(base, err.retryAfterMs)
    : base;
}

/** Writes the outcome only while this worker still holds the lease; otherwise drops it. */
async function finish(
  job: ClaimedJob,
  deps: JobDeps,
  outcome: Omit<JobOutcome, 'now'>,
): Promise<boolean> {
  const applied = await finishJob(deps.db, job, { ...outcome, now: deps.clock.now() });
  if (!applied)
    deps.log.warn(
      { ...logContext(job), status: outcome.status },
      'ai job lease lost; outcome dropped',
    );
  return applied;
}

/**
 * Runs the rules fallback. A fallback that throws ends the job as FAILED (terminal, never
 * reclaimed) instead of crashing the worker on the same row again and again.
 */
async function applyFallback(job: ClaimedJob, deps: JobDeps, handlers: JobHandlers, code: string) {
  try {
    await handlers[job.kind].fallback(job, deps);
  } catch (err) {
    deps.log.error({ ...logContext(job), code, err }, 'ai job fallback failed; job is FAILED');
    await finish(job, deps, { status: 'FAILED', errorCode: code }).catch((finishErr: unknown) =>
      deps.log.error({ ...logContext(job), err: finishErr }, 'could not mark ai job FAILED'),
    );
    return;
  }
  if (await finish(job, deps, { status: 'FALLBACK', errorCode: code }))
    deps.log.warn({ ...logContext(job), code }, 'ai job fell back to rules');
}

async function onError(job: ClaimedJob, deps: JobDeps, handlers: JobHandlers, err: unknown) {
  const code = errorCodeOf(err);
  const retryable = err instanceof AiError ? err.retryable : true;
  if (!(err instanceof AiError))
    deps.log.error({ ...logContext(job), err }, 'ai job failed unexpectedly');
  if (!retryable || job.attempts >= job.maxAttempts)
    return applyFallback(job, deps, handlers, code);
  const runAfter = new Date(deps.clock.now().getTime() + retryDelay(err, job.attempts));
  if (await requeueJob(deps.db, job, runAfter, code))
    deps.log.warn({ ...logContext(job), code, runAfter }, 'ai job will retry');
  else deps.log.warn(logContext(job), 'ai job lease lost; retry dropped');
}

/**
 * Runs one job end to end. A job superseded by a newer one of its kind finishes without calling
 * the model. Transient errors retry with backoff; the rest fall back immediately.
 */
export async function processJob(
  job: ClaimedJob,
  deps: JobDeps,
  handlers: JobHandlers = HANDLERS,
): Promise<void> {
  if (!(await isLatestGeneration(deps.db, job))) {
    await finish(job, deps, { status: 'SUCCEEDED', errorCode: 'SUPERSEDED' });
    return;
  }
  if (job.attempts > job.maxAttempts)
    return applyFallback(job, deps, handlers, 'ATTEMPTS_EXHAUSTED');
  try {
    await handlers[job.kind].runAi(job, deps);
  } catch (err) {
    return onError(job, deps, handlers, err);
  }
  await finish(job, deps, { status: 'SUCCEEDED', errorCode: null });
}
