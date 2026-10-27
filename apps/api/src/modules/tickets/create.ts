import type { Prisma } from '@prisma/client';
import {
  type AuthorTicket,
  type CreateTicketRequestSchema,
  type TicketCategory,
  type TicketSource,
} from '@bookleaf/shared';
import type { z } from 'zod';
import { enqueueJob } from '../../ai/jobs/queue.js';
import { higherPriority, priorityFloor } from '../../ai/triage/rules.js';
import { isUniqueViolation } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import { authorIdOf, type Session } from '../auth/session.js';
import type { TicketDeps } from './deps.js';
import { toAuthorTicket } from './mappers.js';
import { findMessages, findTicketOrThrow } from './repository.js';
import { slaDueAt } from './sla.js';

export type CreateTicketInput = z.output<typeof CreateTicketRequestSchema>;

/** Where the ticket was raised. Chat/voice tickets keep a link to the conversation. */
export interface TicketOrigin {
  source: TicketSource;
  chatSessionId?: string | null;
  voiceSessionId?: string | null;
  /** Issue type the author picked; triage keeps it (categorySource AUTHOR). */
  category?: TicketCategory | null;
  /** Runs inside the creating transaction, e.g. to mark a ticket draft as sent. */
  afterCreate?: (tx: Prisma.TransactionClient, ticketId: string) => Promise<void>;
}

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

interface NewTicket {
  authorId: string;
  input: CreateTicketInput;
  origin: TicketOrigin;
  idempotencyKey: string | null;
  now: Date;
}

function ticketData({ authorId, input, origin, idempotencyKey, now }: NewTicket) {
  const category = origin.category ?? null;
  const floor = priorityFloor({
    text: `${input.subject}\n${input.description}`,
    category: category ?? 'GENERAL_INQUIRY',
    royaltyStatus: null,
  });
  const priority = higherPriority('MEDIUM', floor.floor);
  return {
    authorId,
    bookId: input.bookId,
    subject: input.subject,
    description: input.description,
    ...(category ? { category, categorySource: 'AUTHOR' as const } : {}),
    priority,
    prioritySource: 'RULES',
    priorityReasons: floor.reasons,
    slaDueAt: slaDueAt(now, priority),
    clientRequestId: idempotencyKey,
    source: origin.source,
    chatSessionId: origin.chatSessionId ?? null,
    voiceSessionId: origin.voiceSessionId ?? null,
    createdAt: now,
  } satisfies Prisma.TicketUncheckedCreateInput;
}

/** Ticket, acknowledgement, TRIAGE job and the caller's afterCreate step: all or nothing. */
async function insertTicket(
  deps: TicketDeps,
  data: Prisma.TicketUncheckedCreateInput,
  origin: TicketOrigin,
) {
  const now = data.createdAt as Date;
  return deps.db.$transaction(async (tx) => {
    const t = await tx.ticket.create({ data });
    await tx.ticketMessage.create({
      data: { ticketId: t.id, kind: 'SYSTEM', body: ACK, createdAt: now },
    });
    await enqueueJob(tx, t.id, 'TRIAGE', now);
    await origin.afterCreate?.(tx, t.id);
    return t.id;
  });
}

export interface CreateTicketOptions {
  /** Same key again returns the first ticket instead of a duplicate. */
  idempotencyKey: string | null;
  origin?: TicketOrigin;
}

interface Created {
  ticket: AuthorTicket;
  created: boolean;
}

async function requireOwnBook(deps: TicketDeps, authorId: string, bookId: string | null) {
  if (!bookId) return;
  const owns = await deps.db.book.count({ where: { id: bookId, authorId } });
  if (!owns) throw new NotFoundError('Book');
}

/** A replayed request that lost the insert race gets the ticket the first one created. */
async function replayOrThrow(deps: TicketDeps, session: Session, key: string | null, err: unknown) {
  const prior = key && isUniqueViolation(err) ? await existingByKey(deps, session, key) : null;
  if (!prior) throw err;
  return { ticket: prior, created: false };
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
  { idempotencyKey, origin = { source: 'PORTAL' } }: CreateTicketOptions,
): Promise<Created> {
  const authorId = authorIdOf(session);
  const prior = idempotencyKey ? await existingByKey(deps, session, idempotencyKey) : null;
  if (prior) return { ticket: prior, created: false };
  await requireOwnBook(deps, authorId, input.bookId);
  const data = ticketData({ authorId, input, origin, idempotencyKey, now: deps.clock.now() });
  try {
    const id = await insertTicket(deps, data, origin);
    deps.events.publish({ type: 'ticket.created', ticketId: id, authorId, authorVisible: true });
    return { ticket: await getAuthorTicket(deps, session, id), created: true };
  } catch (err) {
    return replayOrThrow(deps, session, idempotencyKey, err);
  }
}
