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

function statusChange(current: Current, input: UpdateTicketRequest, now: Date) {
  if (!input.status || input.status === current.status) return {};
  assertTransition(current.status, input.status);
  const closed = input.status === 'RESOLVED' || input.status === 'CLOSED';
  return { status: input.status, resolvedAt: closed ? now : null };
}

function priorityChange(current: Current, input: UpdateTicketRequest) {
  if (!input.priority) return {};
  return {
    priority: input.priority,
    prioritySource: 'ADMIN' as const,
    needsReview: false,
    ...(current.firstResponseAt ? {} : { slaDueAt: slaDueAt(current.createdAt, input.priority) }),
  };
}

/** Admins can only take a ticket themselves or unassign it. */
function assigneeChange(input: UpdateTicketRequest, session: Session) {
  if (input.assigneeId === undefined) return {};
  if (input.assigneeId !== null && input.assigneeId !== session.userId) {
    throw new ValidationError('You can assign a ticket to yourself or unassign it', [
      { path: 'assigneeId', message: 'Must be your own id or null' },
    ]);
  }
  return { assigneeId: input.assigneeId };
}

/** Builds the change set. Admin choices are marked ADMIN so the AI never overwrites them. */
function changesFor(
  current: Current,
  input: UpdateTicketRequest,
  session: Session,
  now: Date,
): Prisma.TicketUncheckedUpdateManyInput {
  return {
    ...statusChange(current, input, now),
    ...(input.category
      ? { category: input.category, categorySource: 'ADMIN' as const, needsReview: false }
      : {}),
    ...priorityChange(current, input),
    ...assigneeChange(input, session),
  };
}

const snapshot = (t: Current) => ({
  status: t.status,
  category: t.category,
  priority: t.priority,
  assigneeId: t.assigneeId,
});

/** Optimistic locking: the update applies only if nobody changed the ticket since the admin loaded it. */
export async function updateTicket(
  deps: TicketDeps,
  session: Session,
  id: string,
  input: UpdateTicketRequest,
): Promise<AdminTicket> {
  const current = await findTicketOrThrow(deps.db, session, id);
  const now = deps.clock.now();
  const data = changesFor(current, input, session, now);
  await deps.db.$transaction(async (tx) => {
    const res = await tx.ticket.updateMany({
      where: { id, version: input.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (res.count === 0)
      throw new ConflictError(
        'VERSION_CONFLICT',
        'This ticket was changed by someone else. Reload to see the latest version.',
      );
    await tx.auditEvent.create({
      data: {
        actorId: session.userId,
        entityType: 'ticket',
        entityId: id,
        action: 'ticket.updated',
        before: snapshot(current),
        after: { ...snapshot(current), ...input },
      },
    });
  });
  const statusChanged = data.status !== undefined;
  deps.events.publish({
    type: statusChanged ? 'ticket.status_changed' : 'ticket.updated',
    ticketId: id,
    authorId: current.authorId,
    authorVisible: statusChanged,
  });
  return getAdminTicket(deps, session, id);
}

/** Queues a fresh triage (new generation). Older in-flight results are then discarded. */
export async function retryAi(
  deps: TicketDeps,
  session: Session,
  id: string,
): Promise<AdminTicket> {
  const current = await findTicketOrThrow(deps.db, session, id);
  await deps.db.$transaction(async (tx) => {
    await enqueueJob(tx, id, 'TRIAGE', deps.clock.now());
    await tx.ticket.update({ where: { id }, data: { aiState: 'PENDING' } });
  });
  deps.events.publish({
    type: 'ticket.updated',
    ticketId: id,
    authorId: current.authorId,
    authorVisible: false,
  });
  return getAdminTicket(deps, session, id);
}
