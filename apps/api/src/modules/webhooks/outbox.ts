import type { Prisma } from '@prisma/client';
import type { WebhookEvent } from '@bookleaf/shared';
import { SERVER_TICKET_SELECT, toServerTicket } from './payload.js';

type Tx = Prisma.TransactionClient;

export interface TicketEvent {
  workspaceId: string;
  ticketId: string;
  event: WebhookEvent;
  now: Date;
  /** The reply that caused a `ticket.replied` event. */
  messageId?: string;
}

async function payloadFor(tx: Tx, e: TicketEvent): Promise<Prisma.InputJsonObject> {
  const ticket = await tx.ticket.findUniqueOrThrow({
    where: { id: e.ticketId },
    select: SERVER_TICKET_SELECT,
  });
  const message = e.messageId
    ? await tx.ticketMessage.findUniqueOrThrow({
        where: { id: e.messageId },
        select: { id: true, kind: true, body: true, createdAt: true },
      })
    : null;
  return {
    ticket: toServerTicket(ticket),
    ...(message ? { message: { ...message, createdAt: message.createdAt.toISOString() } } : {}),
  };
}

/**
 * The outbox: called inside the transaction that made the change, so a delivery exists if and
 * only if the change was saved. Nothing is written when no webhook wants this event.
 */
export async function queueTicketEvent(tx: Tx, e: TicketEvent): Promise<void> {
  const hooks = await tx.workspaceWebhook.findMany({
    where: { workspaceId: e.workspaceId, active: true, events: { has: e.event } },
    select: { id: true },
  });
  if (hooks.length === 0) return;
  const payload = await payloadFor(tx, e);
  await tx.webhookDelivery.createMany({
    data: hooks.map((h) => ({ webhookId: h.id, event: e.event, payload, nextAttemptAt: e.now })),
  });
}
