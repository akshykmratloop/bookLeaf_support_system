import type { Prisma } from '@prisma/client';
import type { Db } from '../../platform/db.js';
import type { ClaimedJob, JobKind } from './types.js';

type Tx = Prisma.TransactionClient | Db;

/**
 * Claims one runnable job: queued and due, or running with an expired lease (crashed worker).
 * A running job is reclaimed only while it has an attempt left for its fallback: a job that
 * keeps killing its worker is not picked up forever. SKIP LOCKED lets several workers poll
 * safely without taking the same row.
 */
export async function claimNextJob(db: Db, now: Date, leaseMs: number): Promise<ClaimedJob | null> {
  const leaseUntil = new Date(now.getTime() + leaseMs);
  const rows = await db.$queryRaw<ClaimedJob[]>`
    UPDATE ai_jobs
       SET status = 'RUNNING', attempts = attempts + 1, lease_expires_at = ${leaseUntil}
     WHERE id = (
       SELECT id FROM ai_jobs
        WHERE (status = 'QUEUED' AND run_after <= ${now})
           OR (status = 'RUNNING' AND lease_expires_at < ${now} AND attempts <= max_attempts + 1)
        ORDER BY run_after
        FOR UPDATE SKIP LOCKED
        LIMIT 1)
    RETURNING id, ticket_id AS "ticketId", kind::text AS kind, generation, attempts,
              max_attempts AS "maxAttempts", lease_expires_at AS "leaseExpiresAt"`;
  return rows[0] ?? null;
}

export async function enqueueJob(
  tx: Tx,
  ticketId: string,
  kind: JobKind,
  runAfter: Date,
): Promise<number> {
  const latest = await tx.aiJob.aggregate({
    where: { ticketId, kind },
    _max: { generation: true },
  });
  const generation = (latest._max.generation ?? 0) + 1;
  await tx.aiJob.create({ data: { ticketId, kind, generation, runAfter } });
  return generation;
}

/** Results are written only by the newest job of a kind; older or duplicate runs are discarded. */
export async function isLatestGeneration(tx: Tx, job: ClaimedJob): Promise<boolean> {
  const latest = await tx.aiJob.aggregate({
    where: { ticketId: job.ticketId, kind: job.kind },
    _max: { generation: true },
  });
  return latest._max.generation === job.generation;
}

export interface JobOutcome {
  status: 'SUCCEEDED' | 'FALLBACK' | 'FAILED';
  now: Date;
  errorCode: string | null;
}

/** Only the worker still holding this lease may change the row (another may have reclaimed it). */
const stillHeld = (job: ClaimedJob) => ({
  id: job.id,
  status: 'RUNNING' as const,
  leaseExpiresAt: job.leaseExpiresAt,
});

/** Returns false when the lease was lost: the row is left to the worker that holds it now. */
export async function finishJob(
  db: Db,
  job: ClaimedJob,
  { status, now, errorCode }: JobOutcome,
): Promise<boolean> {
  const res = await db.aiJob.updateMany({
    where: stillHeld(job),
    data: {
      status,
      finishedAt: now,
      leaseExpiresAt: null,
      ...(errorCode ? { lastErrorCode: errorCode } : {}),
    },
  });
  return res.count === 1;
}

/** Returns false when the lease was lost, as finishJob. */
export async function requeueJob(
  db: Db,
  job: ClaimedJob,
  runAfter: Date,
  errorCode: string,
): Promise<boolean> {
  const res = await db.aiJob.updateMany({
    where: stillHeld(job),
    data: { status: 'QUEUED', runAfter, leaseExpiresAt: null, lastErrorCode: errorCode },
  });
  return res.count === 1;
}
