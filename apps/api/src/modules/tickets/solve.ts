import type { AuthorTicket } from '@bookleaf/shared';
import { ConflictError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { getAuthorTicket } from './create.js';
import type { TicketDeps } from './deps.js';
import { findTicketOrThrow } from './repository.js';
import { queueTicketEvent } from '../webhooks/outbox.js';

const SOLVED_NOTE = 'The author marked this ticket as solved.';

type Tx = Parameters<Parameters<TicketDeps['db']['$transaction']>[0]>[0];
type Current = Awaited<ReturnType<typeof findTicketOrThrow>>;

/** Status, note, audit and webhook event in one write. */
async function markSolved(tx: Tx, session: Session, current: Current, now: Date) {
  const id = current.id;
  // Status re-checked in the same write, so a ticket staff just closed is never touched.
  const res = await tx.ticket.updateMany({
    where: { id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    data: { status: 'RESOLVED', resolvedAt: now, version: { increment: 1 } },
  });
  if (res.count !== 1)
    throw new ConflictError('ALREADY_SOLVED', 'This ticket is already solved or closed.');
  await tx.ticketMessage.create({
    data: { ticketId: id, kind: 'SYSTEM', body: SOLVED_NOTE, createdAt: now },
  });
  await tx.auditEvent.create({
    data: {
      workspaceId: current.workspaceId,
      actorId: session.userId,
      entityType: 'ticket',
      entityId: id,
      action: 'ticket.solved_by_author',
      before: { status: current.status },
      after: { status: 'RESOLVED' },
    },
  });
  const event = 'ticket.status_changed' as const;
  await queueTicketEvent(tx, { workspaceId: current.workspaceId, ticketId: id, event, now });
}

/**
 * The author says their issue is solved (an open or in-progress ticket only). A new message from
 * them later reopens it, as for any resolved ticket.
 */
export async function solveTicket(
  deps: TicketDeps,
  session: Session,
  id: string,
): Promise<AuthorTicket> {
  const current = await findTicketOrThrow(deps.db, session, id);
  const now = deps.clock.now();
  await deps.db.$transaction((tx) => markSolved(tx, session, current, now));
  deps.events.publish({
    type: 'ticket.status_changed',
    ticketId: id,
    workspaceId: current.workspaceId,
    authorId: current.authorId,
    authorVisible: true,
  });
  return getAuthorTicket(deps, session, id);
}
