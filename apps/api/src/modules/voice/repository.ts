import type { Prisma } from '@prisma/client';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';

/** A call must be connected within this many seconds of being created. */
export const CONNECT_WITHIN_SECONDS = 30;
/** Grace after the hard cap before a still-ACTIVE call is treated as abandoned. */
const ACTIVE_GRACE_SECONDS = 60;

const WITH_TICKET = { ticket: { select: { id: true, number: true } } };

export async function findOwnCall(db: Db, id: string, authorId: string) {
  const c = await db.voiceSession.findFirst({ where: { id, authorId }, include: WITH_TICKET });
  if (!c) throw new NotFoundError('Voice call');
  return c;
}

/** A call in this workspace; another workspace's call is reported as "not found". */
export async function findWorkspaceCall(db: Db, id: string, workspaceId: string) {
  const c = await db.voiceSession.findFirst({ where: { id, workspaceId }, include: WITH_TICKET });
  if (!c) throw new NotFoundError('Voice call');
  return c;
}

export type VoiceCallRow = Awaited<ReturnType<typeof findOwnCall>>;

/** Calls that never connected expire; ACTIVE calls far past the cap were abandoned (crash). */
export async function expireStale(db: Db, authorId: string, now: Date, maxSeconds: number) {
  await db.voiceSession.updateMany({
    where: {
      authorId,
      status: 'PENDING',
      createdAt: { lt: new Date(now.getTime() - CONNECT_WITHIN_SECONDS * 1000) },
    },
    data: { status: 'EXPIRED' },
  });
  await db.voiceSession.updateMany({
    where: {
      authorId,
      status: 'ACTIVE',
      startedAt: { lt: new Date(now.getTime() - (maxSeconds + ACTIVE_GRACE_SECONDS) * 1000) },
    },
    data: { status: 'FAILED', endReason: 'SERVER_RESTART', endedAt: now },
  });
}

/** Locks the author's row so two "start call" requests cannot both pass the checks. */
export async function lockAuthor(tx: Prisma.TransactionClient, authorId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM authors WHERE id = ${authorId}::uuid FOR UPDATE`;
}

/** Calls that count towards the quota: connected ones (expired or failed-to-connect do not). */
export function countCallsSince(tx: Prisma.TransactionClient, authorId: string, since: Date) {
  return tx.voiceSession.count({
    where: { authorId, createdAt: { gte: since }, startedAt: { not: null } },
  });
}

/** On server start: calls that were live in a previous process can never resume. */
export function failInterruptedCalls(db: Db, now: Date) {
  return db.voiceSession.updateMany({
    where: { status: { in: ['PENDING', 'ACTIVE'] } },
    data: { status: 'FAILED', endReason: 'SERVER_RESTART', endedAt: now },
  });
}

/** A call that broke during setup or saving: release it now so the author can call again. */
export function markCallFailed(db: Db, id: string, now: Date) {
  return db.voiceSession.updateMany({
    where: { id, status: { in: ['PENDING', 'ACTIVE'] } },
    data: { status: 'FAILED', endReason: 'PROVIDER_ERROR', endedAt: now },
  });
}

/**
 * Starting a new call replaces the author's calls that never connected (mic denied, tab
 * closed, double click), so they never block the author. Run inside the author-row lock.
 */
export function replaceUnconnectedCalls(tx: Prisma.TransactionClient, authorId: string) {
  return tx.voiceSession.updateMany({
    where: { authorId, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  });
}
