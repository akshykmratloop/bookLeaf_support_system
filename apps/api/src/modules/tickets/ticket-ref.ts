import type { Prisma } from '@prisma/client';
import { ticketNumberLabel } from '@bookleaf/shared';

/** What a ticket label needs: the number and its workspace's fixed prefix (F-13). */
export const TICKET_LABEL_SELECT = {
  number: true,
  workspace: { select: { ticketPrefix: true } },
} satisfies Prisma.TicketSelect;

/** A ticket reference (id + label), as included by chats, calls and drafts. */
export const TICKET_REF_SELECT = { id: true, ...TICKET_LABEL_SELECT } satisfies Prisma.TicketSelect;

export interface LabelledTicket {
  number: number;
  workspace: { ticketPrefix: string };
}

/** "BL-1001". */
export const labelOf = (t: LabelledTicket): string =>
  ticketNumberLabel(t.workspace.ticketPrefix, t.number);

export const ticketRefOf = (t: LabelledTicket & { id: string }) => ({
  id: t.id,
  number: labelOf(t),
});
