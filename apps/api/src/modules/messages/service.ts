import type { Prisma } from '@prisma/client';
import type { AdminTicket, CheckResult } from '@bookleaf/shared';
import { canOverride, checkReply } from '../../ai/checker/index.js';
import { draftInputFromContext } from '../../ai/drafting/from-context.js';
import { loadTicketContext } from '../../ai/jobs/context.js';
import { CheckFailedError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import type { TicketDeps } from '../tickets/deps.js';
import { getAdminTicket } from '../tickets/queries.js';
import { findTicketOrThrow } from '../tickets/repository.js';
import { findByKey, writeOnce } from './once.js';
import { recordReply, type OverrideAudit } from './record-reply.js';

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
  const input = draftInputFromContext(await loadTicketContext(deps, ticketId));
  return checkReply({ body, facts: input.facts, ignorePhrases: input.ignorePhrases });
}

/**
 * Placeholders always block. Other blocking issues need a written override reason. Returns the
 * audit row for an override, written in the same transaction as the reply (null: nothing to audit).
 */
async function gateReply(
  deps: TicketDeps,
  session: Session,
  ticket: Ticket,
  input: MessageInput,
): Promise<OverrideAudit | null> {
  const result = await checkReplyForTicket(deps, ticket.id, input.body);
  if (result.passed) return null;
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
  return {
    workspaceId: ticket.workspaceId,
    actorId: session.userId,
    entityType: 'ticket',
    entityId: ticket.id,
    action: 'reply.check_override',
    reason: input.overrideReason,
    after: { issues: result.issues } as unknown as Prisma.InputJsonValue,
  };
}

export type AdminMessage = MessageInput & { idempotencyKey: string | null };

/** An admin reply is the only way text reaches the author, and it always passes the checker gate. */
export async function addAdminMessage(
  deps: TicketDeps,
  session: Session,
  ticketId: string,
  input: AdminMessage,
): Promise<AdminTicket> {
  const ticket = await findTicketOrThrow(deps.db, session, ticketId);
  const key = input.idempotencyKey;
  if (await findByKey(deps, ticketId, key)) return getAdminTicket(deps, session, ticketId);
  const kind = input.kind ?? 'REPLY';
  const audit = kind === 'REPLY' ? await gateReply(deps, session, ticket, input) : null;
  const now = deps.clock.now();
  await writeOnce(() =>
    deps.db.$transaction(async (tx) => {
      const message = await tx.ticketMessage.create({
        data: {
          ticketId,
          kind,
          body: input.body,
          senderId: session.userId,
          clientRequestId: key,
          createdAt: now,
        },
      });
      if (kind === 'REPLY') await recordReply(tx, { ticket, now, messageId: message.id, audit });
    }),
  );
  const authorVisible = kind === 'REPLY';
  deps.events.publish({
    type: authorVisible ? 'ticket.replied' : 'ticket.note_added',
    ticketId,
    workspaceId: ticket.workspaceId,
    authorId: ticket.authorId,
    authorVisible,
  });
  return getAdminTicket(deps, session, ticketId);
}

export { addAuthorMessage, type AuthorMessage } from './author-message.js';
