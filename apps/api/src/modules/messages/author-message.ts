import type { AuthorTicket } from '@bookleaf/shared';
import { enqueueJob } from '../../ai/jobs/queue.js';
import type { Session } from '../auth/session.js';
import type { TicketDeps } from '../tickets/deps.js';
import { getAuthorTicket } from '../tickets/queries.js';
import { findTicketOrThrow } from '../tickets/repository.js';
import {
  assertAuthorCanWrite,
  AUTHOR_WRITABLE,
  ticketSolvedError,
} from '../tickets/status-machine.js';
import { findByKey, writeOnce } from './once.js';

export interface AuthorMessage {
  body: string;
  /** Same key again returns the ticket without adding a second message. */
  idempotencyKey: string | null;
}

type Tx = Parameters<Parameters<TicketDeps['db']['$transaction']>[0]>[0];

interface Write {
  ticketId: string;
  body: string;
  senderId: string;
  key: string | null;
  now: Date;
}

/**
 * The lock is checked again inside the write: a ticket solved a moment ago never takes the
 * message, and the transaction rolls back with a 409.
 */
async function writeAuthorMessage(tx: Tx, w: Write): Promise<void> {
  const open = await tx.ticket.updateMany({
    where: { id: w.ticketId, status: { in: [...AUTHOR_WRITABLE] } },
    data: { version: { increment: 1 } },
  });
  if (open.count !== 1) throw ticketSolvedError();
  await tx.ticketMessage.create({
    data: {
      ticketId: w.ticketId,
      kind: 'AUTHOR',
      body: w.body,
      senderId: w.senderId,
      clientRequestId: w.key,
      createdAt: w.now,
    },
  });
  await enqueueJob(tx, w.ticketId, 'DRAFT', w.now);
}

/**
 * The author's follow-up on an open ticket. A solved or closed ticket is locked for the author
 * (409 TICKET_SOLVED): they raise a new ticket instead, and only staff can reopen it (U-2).
 */
export async function addAuthorMessage(
  deps: TicketDeps,
  session: Session,
  ticketId: string,
  { body, idempotencyKey: key }: AuthorMessage,
): Promise<AuthorTicket> {
  const ticket = await findTicketOrThrow(deps.db, session, ticketId);
  if (await findByKey(deps, ticketId, key)) return getAuthorTicket(deps, session, ticketId);
  assertAuthorCanWrite(ticket.status);
  const now = deps.clock.now();
  const write = { ticketId, body, senderId: session.userId, key, now };
  await writeOnce(() => deps.db.$transaction((tx) => writeAuthorMessage(tx, write)));
  deps.events.publish({
    type: 'ticket.updated',
    ticketId,
    workspaceId: ticket.workspaceId,
    authorId: ticket.authorId,
    authorVisible: true,
  });
  return getAuthorTicket(deps, session, ticketId);
}
