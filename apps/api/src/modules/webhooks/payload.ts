import type { Prisma } from '@prisma/client';
import type { ServerTicket } from '@bookleaf/shared';
import { labelOf, TICKET_LABEL_SELECT } from '../tickets/ticket-ref.js';

/** The columns a server-facing ticket is built from. */
export const SERVER_TICKET_SELECT = {
  id: true,
  ...TICKET_LABEL_SELECT,
  status: true,
  category: true,
  priority: true,
  subject: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { externalId: true } },
  book: { select: { externalId: true } },
} satisfies Prisma.TicketSelect;

type Row = Prisma.TicketGetPayload<{ select: typeof SERVER_TICKET_SELECT }>;

/** A ticket in the host's own ids (customer, item): no internal fields, no AI internals. */
export const toServerTicket = (t: Row): ServerTicket => ({
  id: t.id,
  number: labelOf(t),
  status: t.status,
  category: t.category,
  priority: t.priority,
  subject: t.subject,
  customerId: t.author.externalId,
  itemId: t.book?.externalId ?? null,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});
