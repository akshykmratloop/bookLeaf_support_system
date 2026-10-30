import type { Prisma } from '@prisma/client';
import { queueTicketEvent } from '../webhooks/outbox.js';

/** Only who the ticket is: its status is read inside the write. */
interface RepliedTicket {
  id: string;
  workspaceId: string;
}

export type OverrideAudit = Prisma.AuditEventUncheckedCreateInput;

export interface SentReply {
  ticket: RepliedTicket;
  now: Date;
  messageId: string;
  audit: OverrideAudit | null;
}

/**
 * Inside the reply's transaction: the override audit, the status change (the first reply moves an
 * open ticket to In progress and stops the first-response clock), and the webhook event. Status
 * and clock are decided by the row as it is now, never by the copy read before the checker ran:
 * a ticket the author solved meanwhile stays Resolved (U-2).
 */
export async function recordReply(
  tx: Prisma.TransactionClient,
  { ticket, now, messageId, audit }: SentReply,
) {
  const id = ticket.id;
  if (audit) await tx.auditEvent.create({ data: audit });
  await tx.ticket.updateMany({ where: { id, status: 'OPEN' }, data: { status: 'IN_PROGRESS' } });
  await tx.ticket.updateMany({
    where: { id, firstResponseAt: null },
    data: { firstResponseAt: now },
  });
  await tx.ticket.update({ where: { id }, data: { version: { increment: 1 } } });
  await queueTicketEvent(tx, {
    workspaceId: ticket.workspaceId,
    ticketId: ticket.id,
    event: 'ticket.replied',
    now,
    messageId,
  });
}
