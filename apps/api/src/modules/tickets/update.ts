import type { Prisma } from '@prisma/client';
import type { AdminTicket, UpdateTicketRequest } from '@bookleaf/shared';
import { enqueueJob } from '../../ai/jobs/queue.js';
import { ConflictError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import type { TicketDeps } from './deps.js';
import { getAdminTicket } from './queries.js';
import { findTicketOrThrow } from './repository.js';
import { slaDueAt } from './sla.js';
import { assertTransition } from './status-machine.js';

type Current = Awaited<ReturnType<typeof findTicketOrThrow>>;

/** Builds the change set. Admin choices are marked ADMIN so the AI never overwrites them. */
function changesFor(current: Current, input: UpdateTicketRequest, session: Session, now: Date): Prisma.TicketUncheckedUpdateManyInput {
  const data: Prisma.TicketUncheckedUpdateManyInput = {};
  if (input.status && input.status !== current.status) {
    assertTransition(current.status, input.status);
    data.status = input.status;
    data.resolvedAt = input.status === 'RESOLVED' || input.status === 'CLOSED' ? now : null;
  }
  if (input.category) Object.assign(data, { category: input.category, categorySource: 'ADMIN', needsReview: false });
  if (input.priority) {
    Object.assign(data, { priority: input.priority, prioritySource: 'ADMIN', needsReview: false });
    if (!current.firstResponseAt) data.slaDueAt = slaDueAt(current.createdAt, input.priority);
  }
  if (input.assigneeId !== undefined) {
    if (input.assigneeId !== null && input.assigneeId !== session.userId) {
      throw new ValidationError('You can assign a ticket to yourself or unassign it', [{ path: 'assigneeId', message: 'Must be your own id or null' }]);
    }
    data.assigneeId = input.assigneeId;
  }
  return data;
}

const snapshot = (t: Current) => ({ status: t.status, category: t.category, priority: t.priority, assigneeId: t.assigneeId });

/** Optimistic locking: the update applies only if nobody changed the ticket since the admin loaded it. */
export async function updateTicket(deps: TicketDeps, session: Session, id: string, input: UpdateTicketRequest): Promise<AdminTicket> {
  const current = await findTicketOrThrow(deps.db, session, id);
  const now = deps.clock.now();
  const data = changesFor(current, input, session, now);
  await deps.db.$transaction(async (tx) => {
    const res = await tx.ticket.updateMany({ where: { id, version: input.version }, data: { ...data, version: { increment: 1 } } });
    if (res.count === 0) throw new ConflictError('VERSION_CONFLICT', 'This ticket was changed by someone else. Reload to see the latest version.');
    await tx.auditEvent.create({
      data: { actorId: session.userId, entityType: 'ticket', entityId: id, action: 'ticket.updated', before: snapshot(current), after: { ...snapshot(current), ...input } },
    });
  });
  const statusChanged = data.status !== undefined;
  deps.events.publish({ type: statusChanged ? 'ticket.status_changed' : 'ticket.updated', ticketId: id, authorId: current.authorId, authorVisible: statusChanged });
  return getAdminTicket(deps, session, id);
}

/** Queues a fresh triage (new generation). Older in-flight results are then discarded. */
export async function retryAi(deps: TicketDeps, session: Session, id: string): Promise<AdminTicket> {
  const current = await findTicketOrThrow(deps.db, session, id);
  await deps.db.$transaction(async (tx) => {
    await enqueueJob(tx, id, 'TRIAGE', deps.clock.now());
    await tx.ticket.update({ where: { id }, data: { aiState: 'PENDING' } });
  });
  deps.events.publish({ type: 'ticket.updated', ticketId: id, authorId: current.authorId, authorVisible: false });
  return getAdminTicket(deps, session, id);
}
