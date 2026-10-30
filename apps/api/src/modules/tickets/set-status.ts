import type { Prisma, TicketStatus } from '@prisma/client';
import type { Db } from '../../platform/db.js';
import { ConflictError, NotFoundError } from '../../platform/errors.js';
import type { TicketDeps } from './deps.js';
import { statusChange } from './update.js';
import { queueTicketEvent } from '../webhooks/outbox.js';

/** Who asks for the change when it is not a signed-in staff member (the server API, U-11). */
export interface StatusRequester {
  workspaceId: string;
  /** Recorded on the audit row, e.g. `{ via: 'api_key', key: 'blsk_ab12cd34' }`. */
  via: Record<string, string>;
}

export interface StatusRequest {
  to: TicketStatus;
  /** The same key again returns without applying the change a second time. */
  idempotencyKey: string | null;
}

const ACTION = 'ticket.status_set_by_api';
const RACED = 'STATUS_RACED';

type Current = { id: string; status: TicketStatus; workspaceId: string; authorId: string };

async function alreadyApplied(db: Db, ticketId: string, key: string | null) {
  if (!key) return false;
  const where: Prisma.AuditEventWhereInput = {
    entityType: 'ticket',
    entityId: ticketId,
    action: ACTION,
    after: { path: ['idempotencyKey'], equals: key },
  };
  return (await db.auditEvent.count({ where })) > 0;
}

/** The status write (only if nobody changed the status meanwhile), audit row and webhook event. */
async function write(
  tx: Prisma.TransactionClient,
  u: { current: Current; who: StatusRequester; req: StatusRequest; now: Date },
) {
  const { current, who, req, now } = u;
  const data = statusChange(current, { status: req.to }, now);
  const changed = data.status !== undefined;
  if (changed) {
    const res = await tx.ticket.updateMany({
      where: { id: current.id, status: current.status },
      data: { ...data, version: { increment: 1 } },
    });
    if (res.count !== 1) throw new ConflictError(RACED, 'The ticket changed at the same time.');
  }
  if (!changed && !req.idempotencyKey) return false;
  await tx.auditEvent.create({
    data: {
      workspaceId: who.workspaceId,
      entityType: 'ticket',
      entityId: current.id,
      action: ACTION,
      before: { status: current.status },
      after: { status: req.to, ...who.via, idempotencyKey: req.idempotencyKey },
    },
  });
  if (changed) {
    const event = 'ticket.status_changed' as const;
    await queueTicketEvent(tx, { workspaceId: who.workspaceId, ticketId: current.id, event, now });
  }
  return changed;
}

/**
 * Resolve, close or reopen a ticket on behalf of the workspace's own server. The allowed moves are
 * the staff status rules (`statusChange` → `assertTransition`), so a rule changes in one place.
 * Moving to the status it already has is a no-op.
 */
export async function setTicketStatus(
  deps: TicketDeps,
  who: StatusRequester,
  id: string,
  req: StatusRequest,
): Promise<void> {
  const current = await deps.db.ticket.findFirst({
    where: { id, workspaceId: who.workspaceId },
    select: { id: true, status: true, workspaceId: true, authorId: true },
  });
  if (!current) throw new NotFoundError('Ticket');
  if (await alreadyApplied(deps.db, id, req.idempotencyKey)) return;
  const now = deps.clock.now();
  try {
    const changed = await deps.db.$transaction((tx) => write(tx, { current, who, req, now }));
    if (!changed) return;
  } catch (err) {
    if (!(err instanceof ConflictError) || err.code !== RACED) throw err;
    const latest = await deps.db.ticket.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    if (latest.status === req.to) return;
    throw new ConflictError('VERSION_CONFLICT', 'The ticket changed meanwhile. Read it again.');
  }
  deps.events.publish({
    type: 'ticket.status_changed',
    ticketId: id,
    workspaceId: who.workspaceId,
    authorId: current.authorId,
    authorVisible: true,
  });
}
