import type { ServerCreateTicket, ServerStatusChange, ServerTicketDetail } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { ConflictError, NotFoundError } from '../../platform/errors.js';
import { addAuthorMessage } from '../messages/service.js';
import { createTicket } from '../tickets/create.js';
import type { TicketDeps } from '../tickets/deps.js';
import { setTicketStatus } from '../tickets/set-status.js';
import type { KeyGrant } from './api-key-auth.js';
import { customerSession, itemOf, ticketOwnerSession } from './customers.js';
import { getServerTicket } from './queries.js';

/**
 * What the workspace's own server may change with a `tickets:write` key (U-11). Every write goes
 * through the same ticket code the widget and the staff app use: the same triage, idempotency,
 * status rules, live updates and webhooks.
 */

/** An Idempotency-Key names one request: reusing it for another customer is refused. */
async function refuseKeyReuse(db: Db, workspaceId: string, customerId: string, key: string | null) {
  if (!key) return;
  const prior = await db.ticket.findFirst({
    where: { workspaceId, clientRequestId: key },
    select: { author: { select: { externalId: true } } },
  });
  if (prior && prior.author.externalId !== customerId)
    throw new ConflictError(
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used for another customer. Send a new key for a new request.',
    );
}

export async function createServerTicket(
  deps: TicketDeps,
  grant: KeyGrant,
  input: ServerCreateTicket,
  idempotencyKey: string | null,
): Promise<{ ticket: ServerTicketDetail; created: boolean }> {
  const { workspaceId } = grant;
  await refuseKeyReuse(deps.db, workspaceId, input.customerId, idempotencyKey);
  const session = await customerSession(deps, workspaceId, input.customerId);
  const bookId = await itemOf(deps, session, input.customerId, input.itemId);
  const { ticket, created } = await createTicket(
    deps,
    session,
    { bookId, subject: input.subject, description: input.body },
    { idempotencyKey, origin: { source: 'API' } },
  );
  return { ticket: await getServerTicket(deps.db, workspaceId, ticket.id), created };
}

async function ownerOf(db: Db, workspaceId: string, ticketId: string) {
  const t = await db.ticket.findFirst({
    where: { id: ticketId, workspaceId },
    select: { authorId: true },
  });
  if (!t) throw new NotFoundError('Ticket');
  return ticketOwnerSession(db, t.authorId);
}

/** A message from the customer, exactly as if they had written it in the widget. */
export async function addServerMessage(
  deps: TicketDeps,
  grant: KeyGrant,
  ticketId: string,
  message: { body: string; idempotencyKey: string | null },
): Promise<ServerTicketDetail> {
  const session = await ownerOf(deps.db, grant.workspaceId, ticketId);
  await addAuthorMessage(deps, session, ticketId, message);
  return getServerTicket(deps.db, grant.workspaceId, ticketId);
}

/** Resolve, close or reopen, under the ticket status rules. */
export async function changeServerStatus(
  deps: TicketDeps,
  grant: KeyGrant,
  ticketId: string,
  { status, idempotencyKey }: ServerStatusChange & { idempotencyKey: string | null },
): Promise<ServerTicketDetail> {
  const who = { workspaceId: grant.workspaceId, via: { via: 'api_key', key: grant.prefix } };
  await setTicketStatus(deps, who, ticketId, { to: status, idempotencyKey });
  return getServerTicket(deps.db, grant.workspaceId, ticketId);
}
