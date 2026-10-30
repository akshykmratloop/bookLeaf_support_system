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
import { assertActiveCategory } from '../categories/load-knowledge.js';
import { queueTicketEvent } from '../webhooks/outbox.js';

type Current = Awaited<ReturnType<typeof findTicketOrThrow>>;

/** The staff status rules; the server API (U-11) changes status through this too. */
export function statusChange(
  current: Pick<Current, 'status'>,
  input: Pick<UpdateTicketRequest, 'status'>,
  now: Date,
) {
  if (!input.status || input.status === current.status) return {};
  assertTransition(current.status, input.status);
  const closed = input.status === 'RESOLVED' || input.status === 'CLOSED';
  return { status: input.status, resolvedAt: closed ? now : null };
}

function priorityChange(input: UpdateTicketRequest) {
  if (!input.priority) return {};
  return { priority: input.priority, prioritySource: 'ADMIN' as const, needsReview: false };
}

/** The category a PATCH moves the ticket to, with its SLA hours; null when it stays put. */
type CategoryMove = { key: string; slaHours: number | null } | null;

/**
 * The first-response deadline follows the ticket's priority and category after the change (S.9),
 * so it moves when either changes, until the first reply is sent.
 */
function slaChange(current: Current, input: UpdateTicketRequest, move: CategoryMove) {
  if (current.firstResponseAt || (!move && !input.priority)) return {};
  const priority = input.priority ?? current.priority;
  const hours = move ? move.slaHours : current.category?.slaHours;
  return { slaDueAt: slaDueAt(current.createdAt, priority, hours) };
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
  u: { input: UpdateTicketRequest; move: CategoryMove; session: Session; now: Date },
): Prisma.TicketUncheckedUpdateManyInput {
  const { input, move } = u;
  return {
    ...statusChange(current, input, u.now),
    ...(input.category
      ? { categoryKey: input.category, categorySource: 'ADMIN' as const, needsReview: false }
      : {}),
    ...priorityChange(input),
    ...slaChange(current, input, move),
    ...assigneeChange(input, u.session),
  };
}

/** Checks a new category is one of the workspace's active ones and reads its SLA hours. */
async function categoryMove(
  deps: TicketDeps,
  current: Current,
  input: UpdateTicketRequest,
): Promise<CategoryMove> {
  if (!input.category || input.category === current.categoryKey) return null;
  const { slaHours } = await assertActiveCategory(deps.db, current.workspaceId, input.category);
  return { key: input.category, slaHours };
}

const snapshot = (t: Current) => ({
  status: t.status,
  category: t.categoryKey,
  priority: t.priority,
  assigneeId: t.assigneeId,
});

type Tx = Parameters<Parameters<TicketDeps['db']['$transaction']>[0]>[0];

/** The audit row and, for a status change, the webhook event, in the update's own write. */
async function recordUpdate(
  tx: Tx,
  u: {
    session: Session;
    current: Current;
    input: UpdateTicketRequest;
    now: Date;
    statusChanged: boolean;
  },
) {
  const { session, current, input, now } = u;
  await tx.auditEvent.create({
    data: {
      workspaceId: current.workspaceId,
      actorId: session.userId,
      entityType: 'ticket',
      entityId: current.id,
      action: 'ticket.updated',
      before: snapshot(current),
      after: { ...snapshot(current), ...input },
    },
  });
  if (!u.statusChanged) return;
  const event = 'ticket.status_changed' as const;
  await queueTicketEvent(tx, {
    workspaceId: current.workspaceId,
    ticketId: current.id,
    event,
    now,
  });
}

/** Optimistic locking: the update applies only if nobody changed the ticket since the admin loaded it. */
export async function updateTicket(
  deps: TicketDeps,
  session: Session,
  id: string,
  input: UpdateTicketRequest,
): Promise<AdminTicket> {
  const current = await findTicketOrThrow(deps.db, session, id);
  const move = await categoryMove(deps, current, input);
  const now = deps.clock.now();
  const data = changesFor(current, { input, move, session, now });
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
    await recordUpdate(tx, {
      session,
      current,
      input,
      now,
      statusChanged: data.status !== undefined,
    });
  });
  const statusChanged = data.status !== undefined;
  deps.events.publish({
    type: statusChanged ? 'ticket.status_changed' : 'ticket.updated',
    ticketId: id,
    workspaceId: current.workspaceId,
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
    workspaceId: current.workspaceId,
    authorId: current.authorId,
    authorVisible: false,
  });
  return getAdminTicket(deps, session, id);
}
