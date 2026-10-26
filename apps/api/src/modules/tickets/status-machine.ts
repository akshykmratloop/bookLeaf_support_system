import type { TicketStatus } from '@bookleaf/shared';
import { ConflictError } from '../../platform/errors.js';

/** Allowed admin status changes. Closed tickets can be reopened; nothing jumps back from Open. */
const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
};

export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw new ConflictError('INVALID_TRANSITION', `A ticket cannot move from ${from} to ${to}`);
  }
}

/** A new author message on a resolved/closed ticket reopens it. */
export function statusAfterAuthorMessage(current: TicketStatus): TicketStatus {
  return current === 'RESOLVED' || current === 'CLOSED' ? 'OPEN' : current;
}
