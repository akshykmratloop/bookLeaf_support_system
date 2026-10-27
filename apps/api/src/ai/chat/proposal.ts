import { DESCRIPTION_LIMITS, SUBJECT_LIMITS, type TicketProposal } from '@bookleaf/shared';
/** A model-written ticket suggestion (voice calls; chat uses the shared ticket draft). */
export interface TicketSuggestion {
  subject: string;
  description: string;
  bookId: string | null;
}

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max).trim() : text);

/**
 * Turns the model's suggestion into a safe proposal: the book must be one of this author's books
 * (anything else becomes "General"), and text is cut to the ticket form's limits. Too-short text
 * falls back to the author's own message. The author still reviews it before a ticket exists.
 */
export function toProposal(
  suggestion: TicketSuggestion | null,
  books: readonly { id: string }[],
  authorMessage: string,
): TicketProposal | null {
  if (!suggestion) return null;
  const bookId = books.some((b) => b.id === suggestion.bookId) ? suggestion.bookId : null;
  let subject = clip(suggestion.subject.trim(), SUBJECT_LIMITS.max);
  if (subject.length < SUBJECT_LIMITS.min) subject = 'Question from Ask BookLeaf chat';
  let description = clip(suggestion.description.trim(), DESCRIPTION_LIMITS.max);
  if (description.length < DESCRIPTION_LIMITS.min)
    description = clip(authorMessage.trim(), DESCRIPTION_LIMITS.max);
  return { subject, description, bookId };
}
