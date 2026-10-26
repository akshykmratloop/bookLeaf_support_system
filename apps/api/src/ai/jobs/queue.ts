import type { Prisma } from '@prisma/client';
import type { Db } from '../../platform/db.js';
import type { ClaimedJob, JobKind } from './types.js';

type Tx = Prisma.TransactionClient | Db;

/**
 * Claims one runnable job: queued and due, or running with an expired lease (crashed worker).
 * SKIP LOCKED lets several workers poll safely without taking the same row.
 */
export async function claimNextJob(db: Db, now: Date, leaseMs: number): Promise<ClaimedJob | null> {
  const leaseUntil = new Date(now.getTime() + leaseMs);
  const rows = await db.$queryRaw<ClaimedJob[]>`
    UPDATE ai_jobs
       SET status = 'RUNNING', attempts = attempts + 1, lease_expires_at = ${leaseUntil}
     WHERE id = (
       SELECT id FROM ai_jobs
        WHERE (status = 'QUEUED' AND run_after <= ${now})
           OR (status = 'RUNNING' AND lease_expires_at < ${now})
        ORDER BY run_after
        FOR UPDATE SKIP LOCKED
        LIMIT 1)
    RETURNING id, ticket_id AS "ticketId", kind::text AS kind, generation, attempts, max_attempts AS "maxAttempts"`;
  return rows[0] ?? null;
}

export async function enqueueJob(tx: Tx, ticketId: string, kind: JobKind, runAfter: Date): Promise<number> {
  const latest = await tx.aiJob.aggregate({ where: { ticketId, kind }, _max: { generation: true } });
  const generation = (latest._max.generation ?? 0) + 1;
  await tx.aiJob.create({ data: { ticketId, kind, generation, runAfter } });
  return generation;
}

/** Results are written only by the newest job of a kind; older or duplicate runs are discarded. */
export async function isLatestGeneration(tx: Tx, job: ClaimedJob): Promise<boolean> {
  const latest = await tx.aiJob.aggregate({ where: { ticketId: job.ticketId, kind: job.kind }, _max: { generation: true } });
  return latest._max.generation === job.generation;
}

export async function finishJob(db: Db, job: ClaimedJob, status: 'SUCCEEDED' | 'FALLBACK', now: Date, errorCode: string | null) {
  await db.aiJob.update({
    where: { id: job.id },
    data: { status, finishedAt: now, leaseExpiresAt: null, ...(errorCode ? { lastErrorCode: errorCode } : {}) },
  });
}

export async function requeueJob(db: Db, job: ClaimedJob, runAfter: Date, errorCode: string) {
  await db.aiJob.update({
    where: { id: job.id },
    data: { status: 'QUEUED', runAfter, leaseExpiresAt: null, lastErrorCode: errorCode },
  });
}
