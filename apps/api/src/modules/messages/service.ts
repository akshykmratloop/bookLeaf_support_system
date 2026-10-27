import { Prisma } from '@prisma/client';
import type { AuthorTicket, AdminTicket, CheckResult } from '@bookleaf/shared';
import { canOverride, checkReply } from '../../ai/checker/index.js';
import { draftInputFromContext } from '../../ai/drafting/from-context.js';
import { loadTicketContext } from '../../ai/jobs/context.js';
import { enqueueJob } from '../../ai/jobs/queue.js';
import { CheckFailedError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import type { TicketDeps } from '../tickets/deps.js';
import { getAdminTicket, getAuthorTicket } from '../tickets/queries.js';
import { findTicketOrThrow } from '../tickets/repository.js';
import { statusAfterAuthorMessage } from '../tickets/status-machine.js';

export interface MessageInput {
  body: string;
  kind?: 'REPLY' | 'INTERNAL_NOTE';
  overrideReason?: string;
}

type Ticket = Awaited<ReturnType<typeof findTicketOrThrow>>;

/** Runs the factual checker against the same facts the draft was built from. */
export async function checkReplyForTicket(
  deps: TicketDeps,
  ticketId: string,
  body: string,
): Promise<CheckResult> {
  const input = draftInputFromContext(
    await loadTicketContext(deps.db, ticketId),
    deps.clock.dataAsOf(),
  );
  return checkReply({ body, facts: input.facts, ignorePhrases: input.ignorePhrases });
}

/** Placeholders always block. Other blocking issues need a written override reason (audited). */
async function gateReply(
  deps: TicketDeps,
  session: Session,
  ticket: Ticket,
  input: MessageInput,
): Promise<void> {
  const result = await checkReplyForTicket(deps, ticket.id, input.body);
  if (result.passed) return;
  if (!canOverride(result))
    throw new CheckFailedError(
      'Fill in every [CONFIRM: …] placeholder and remove internal references before sending.',
      result,
    );
  if (!input.overrideReason)
    throw new CheckFailedError(
      'This reply contains figures or wording that could not be verified. Fix them or give a reason to send anyway.',
      result,
    );
  await deps.db.auditEvent.create({
    data: {
      actorId: session.userId,
      entityType: 'ticket',
      entityId: ticket.id,
      action: 'reply.check_override',
      reason: input.overrideReason,
      after: { issues: result.issues } as unknown as Prisma.InputJsonValue,
    },
  });
}

async function findByKey(deps: TicketDeps, ticketId: string, key: string | null) {
  if (!key) return false;
  return (await deps.db.ticketMessage.count({ where: { ticketId, clientRequestId: key } })) > 0;
}

function isDuplicateKey(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function addAuthorMessage(
  deps: TicketDeps,
  session: Session,
  ticketId: string,
  body: string,
  key: string | null,
): Promise<AuthorTicket> {
  const ticket = await findTicketOrThrow(deps.db, session, ticketId);
  if (await findByKey(deps, ticketId, key)) return getAuthorTicket(deps, session, ticketId);
  const now = deps.clock.now();
  try {
    await deps.db.$transaction(async (tx) => {
      await tx.ticketMessage.create({
        data: {
          ticketId,
          kind: 'AUTHOR',
          body,
          senderId: session.userId,
          clientRequestId: key,
          createdAt: now,
        },
      });
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: statusAfterAuthorMessage(ticket.status), version: { increment: 1 } },
      });
      await enqueueJob(tx, ticketId, 'DRAFT', now);
    });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
  deps.events.publish({
    type: 'ticket.updated',
    ticketId,
    authorId: ticket.authorId,
    authorVisible: true,
  });
  return getAuthorTicket(deps, session, ticketId);
}

/** An admin reply is the only way text reaches the author, and it always passes the checker gate. */
export async function addAdminMessage(
  deps: TicketDeps,
  session: Session,
  ticketId: string,
  input: MessageInput,
  key: string | null,
): Promise<AdminTicket> {
  const ticket = await findTicketOrThrow(deps.db, session, ticketId);
  if (await findByKey(deps, ticketId, key)) return getAdminTicket(deps, session, ticketId);
  const kind = input.kind ?? 'REPLY';
  if (kind === 'REPLY') await gateReply(deps, session, ticket, input);
  const now = deps.clock.now();
  try {
    await deps.db.$transaction(async (tx) => {
      await tx.ticketMessage.create({
        data: {
          ticketId,
          kind,
          body: input.body,
          senderId: session.userId,
          clientRequestId: key,
          createdAt: now,
        },
      });
      if (kind === 'REPLY') {
        const status = ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status;
        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            status,
            firstResponseAt: ticket.firstResponseAt ?? now,
            version: { increment: 1 },
          },
        });
      }
    });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
  const authorVisible = kind === 'REPLY';
  deps.events.publish({
    type: authorVisible ? 'ticket.replied' : 'ticket.note_added',
    ticketId,
    authorId: ticket.authorId,
    authorVisible,
  });
  return getAdminTicket(deps, session, ticketId);
}
