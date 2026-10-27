import { Prisma } from '@prisma/client';
import { type CreateTicketRequestSchema, type AuthorTicket } from '@bookleaf/shared';
import type { z } from 'zod';
import { enqueueJob } from '../../ai/jobs/queue.js';
import { higherPriority, priorityFloor } from '../../ai/triage/rules.js';
import { ForbiddenError, NotFoundError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import type { TicketDeps } from './deps.js';
import { toAuthorTicket } from './mappers.js';
import { findMessages, findTicketOrThrow } from './repository.js';
import { slaDueAt } from './sla.js';

export type CreateTicketInput = z.output<typeof CreateTicketRequestSchema>;

const ACK =
  "Thanks for reaching out. We've received your query and our support team will reply here. You'll see updates on this page without refreshing.";

async function existingByKey(
  deps: TicketDeps,
  session: Session,
  key: string,
): Promise<AuthorTicket | null> {
  const found = await deps.db.ticket.findFirst({
    where: { authorId: session.authorId ?? undefined, clientRequestId: key },
    select: { id: true },
  });
  return found ? getAuthorTicket(deps, session, found.id) : null;
}

export async function getAuthorTicket(
  deps: TicketDeps,
  session: Session,
  id: string,
): Promise<AuthorTicket> {
  const t = await findTicketOrThrow(deps.db, session, id);
  return toAuthorTicket(t, await findMessages(deps.db, t.id, false));
}

/**
 * Ticket, acknowledgement and the TRIAGE job are written in one transaction: either all exist
 * or none do, so a ticket can never be left without AI processing queued.
 * Until triage finishes, priority comes from the rules floor (default Medium).
 */
export async function createTicket(
  deps: TicketDeps,
  session: Session,
  input: CreateTicketInput,
  idempotencyKey: string | null,
): Promise<{ ticket: AuthorTicket; created: boolean }> {
  if (session.role !== 'AUTHOR' || !session.authorId)
    throw new ForbiddenError('Only authors can raise tickets');
  const authorId = session.authorId;
  if (idempotencyKey) {
    const prior = await existingByKey(deps, session, idempotencyKey);
    if (prior) return { ticket: prior, created: false };
  }
  if (input.bookId) {
    const owns = await deps.db.book.count({ where: { id: input.bookId, authorId } });
    if (!owns) throw new NotFoundError('Book');
  }
  const now = deps.clock.now();
  const floor = priorityFloor({
    text: `${input.subject}\n${input.description}`,
    category: 'GENERAL_INQUIRY',
    royaltyStatus: null,
  });
  const priority = higherPriority('MEDIUM', floor.floor);
  try {
    const id = await deps.db.$transaction(async (tx) => {
      const t = await tx.ticket.create({
        data: {
          authorId,
          bookId: input.bookId,
          subject: input.subject,
          description: input.description,
          priority,
          prioritySource: 'RULES',
          priorityReasons: floor.reasons,
          slaDueAt: slaDueAt(now, priority),
          clientRequestId: idempotencyKey,
          createdAt: now,
        },
      });
      await tx.ticketMessage.create({
        data: { ticketId: t.id, kind: 'SYSTEM', body: ACK, createdAt: now },
      });
      await enqueueJob(tx, t.id, 'TRIAGE', now);
      return t.id;
    });
    deps.events.publish({ type: 'ticket.created', ticketId: id, authorId, authorVisible: true });
    return { ticket: await getAuthorTicket(deps, session, id), created: true };
  } catch (err) {
    const duplicate =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && idempotencyKey;
    if (!duplicate) throw err;
    const prior = await existingByKey(deps, session, idempotencyKey);
    if (!prior) throw err;
    return { ticket: prior, created: false };
  }
}
