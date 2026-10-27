import type { TicketProposal } from '@bookleaf/shared';
import { z } from 'zod';
import { toProposal } from '../../ai/chat/proposal.js';

const SuggestArgs = z.object({
  subject: z.string().max(500).default(''),
  description: z.string().max(5000).default(''),
  book_id: z.string().nullable().default(null),
});

/**
 * Validates the model's suggest_ticket arguments. The book must be one of this author's books
 * (anything else becomes account level); text is cut to the ticket limits.
 */
export function parseSuggestion(
  argumentsJson: string,
  books: readonly { id: string }[],
  lastAuthorLine: string,
): TicketProposal | null {
  let raw: unknown;
  try {
    raw = JSON.parse(argumentsJson);
  } catch {
    return null;
  }
  const args = SuggestArgs.safeParse(raw);
  if (!args.success) return null;
  return toProposal(
    { subject: args.data.subject, description: args.data.description, bookId: args.data.book_id },
    books,
    lastAuthorLine,
  );
}
