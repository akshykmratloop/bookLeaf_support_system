import {
  DESCRIPTION_LIMITS,
  SUBJECT_LIMITS,
  ticketNumberLabel,
  type TicketDraft,
} from '@bookleaf/shared';
import type { TicketDraftRow } from './repository.js';

export const isDraftComplete = (d: { subject: string; description: string }) =>
  d.subject.trim().length >= SUBJECT_LIMITS.min &&
  d.description.trim().length >= DESCRIPTION_LIMITS.min;

export function toTicketDraft(d: TicketDraftRow): TicketDraft {
  return {
    id: d.id,
    category: d.category,
    bookId: d.bookId,
    subject: d.subject,
    description: d.description,
    status: d.status,
    version: d.version,
    lastEditedBy: d.lastEditedBy,
    isComplete: isDraftComplete(d),
    ticket: d.ticket ? { id: d.ticket.id, number: ticketNumberLabel(d.ticket.number) } : null,
    updatedAt: d.updatedAt.toISOString(),
  };
}
