import type { Db } from '../../platform/db.js';

/**
 * How long operational rows are kept. Only machine bookkeeping is ever purged: audit events,
 * tickets, messages, chats and calls are never deleted here.
 */
export const RETENTION = {
  aiJobDays: 30,
  webhookDeliveryDays: 30,
  aiRunDays: 90,
  /** Rows per DELETE, so no statement holds locks for long. */
  batch: 1_000,
  /** Statements per table per pass; whatever is left waits for the next pass. */
  maxBatches: 20,
} as const;

/**
 * Finished AI job states. Compared as text so the list may name a state this database does not
 * have yet (FAILED arrives with migration 20261101090000): an unknown name simply matches nothing.
 */
const FINISHED_JOB_STATES = ['SUCCEEDED', 'FALLBACK', 'FAILED'];
/** Deliveries that will never be sent again: delivered, or given up after the last attempt. */
const SETTLED_DELIVERY_STATES = ['SUCCEEDED', 'FAILED'];

const DAY_MS = 86_400_000;
const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

/**
 * Old finished AI jobs, except the newest generation of each ticket and kind: the next job's
 * generation is "highest + 1", and drafts are ordered by generation, so that row must stay.
 */
const deleteAiJobs = (db: Db, before: Date) => db.$executeRaw`
  DELETE FROM ai_jobs WHERE id IN (
    SELECT j.id FROM ai_jobs j
    WHERE j.status::text = ANY(${FINISHED_JOB_STATES}) AND j.created_at < ${before}
      AND EXISTS (
        SELECT 1 FROM ai_jobs n
        WHERE n.ticket_id = j.ticket_id AND n.kind = j.kind AND n.generation > j.generation)
    LIMIT ${RETENTION.batch})`;

const deleteDeliveries = (db: Db, before: Date) => db.$executeRaw`
  DELETE FROM webhook_deliveries WHERE id IN (
    SELECT id FROM webhook_deliveries
    WHERE status::text = ANY(${SETTLED_DELIVERY_STATES}) AND created_at < ${before}
    LIMIT ${RETENTION.batch})`;

const deleteAiRuns = (db: Db, before: Date) => db.$executeRaw`
  DELETE FROM ai_runs WHERE id IN (
    SELECT id FROM ai_runs WHERE created_at < ${before} LIMIT ${RETENTION.batch})`;

/** Repeats one batched DELETE until it removes less than a full batch, or the pass limit. */
async function drain(run: () => Promise<number>): Promise<number> {
  let total = 0;
  for (let i = 0; i < RETENTION.maxBatches; i += 1) {
    const n = await run();
    total += n;
    if (n < RETENTION.batch) break;
  }
  return total;
}

export interface PurgeResult {
  aiJobs: number;
  webhookDeliveries: number;
  aiRuns: number;
}

/** One retention pass. Must run on the platform (owner) path: it spans every workspace. */
export async function purgeOldRows(db: Db, now: Date): Promise<PurgeResult> {
  const aiJobs = await drain(() => deleteAiJobs(db, daysBefore(now, RETENTION.aiJobDays)));
  const webhookDeliveries = await drain(() =>
    deleteDeliveries(db, daysBefore(now, RETENTION.webhookDeliveryDays)),
  );
  const aiRuns = await drain(() => deleteAiRuns(db, daysBefore(now, RETENTION.aiRunDays)));
  return { aiJobs, webhookDeliveries, aiRuns };
}
