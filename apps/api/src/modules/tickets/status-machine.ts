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

/** Statuses the author can still write on. Resolved and Closed tickets are locked (U-2). */
export const AUTHOR_WRITABLE: readonly TicketStatus[] = ['OPEN', 'IN_PROGRESS'];

export const isSolved = (status: TicketStatus): boolean => !AUTHOR_WRITABLE.includes(status);

/** The 409 an author gets for writing on a solved or closed ticket. Only staff can reopen it. */
export function ticketSolvedError(): ConflictError {
  return new ConflictError(
    'TICKET_SOLVED',
    'This ticket is solved, so it no longer takes replies. Raise a new ticket if you need more help.',
  );
}

export function assertAuthorCanWrite(status: TicketStatus): void {
  if (isSolved(status)) throw ticketSolvedError();
}
