import type { TicketDraft } from '@bookleaf/shared';

/** Something is written in the draft: any field, ignoring blank text. */
export const draftHasContent = (d: TicketDraft | null): boolean =>
  !!d && !!(d.subject.trim() || d.description.trim() || d.category || d.bookId);

/**
 * The ticket box is shown only when there is a ticket to show: a draft with content, one the
 * assistant is asking the author to confirm, one already sent, or when the author opened it.
 * A blank "Not sent" box is never shown on its own.
 */
export function shouldShowTicket(d: TicketDraft | null, { opened }: { opened: boolean }): boolean {
  if (opened) return true;
  if (!d) return false;
  return d.status !== 'OPEN' || draftHasContent(d);
}
