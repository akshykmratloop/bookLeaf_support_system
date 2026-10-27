import {
  DESCRIPTION_LIMITS,
  SUBJECT_LIMITS,
  TICKET_CATEGORIES,
  sanitizeText,
  type TicketCategory,
} from '@bookleaf/shared';
import { z } from 'zod';

export const DRAFT_ACTIONS = ['none', 'update', 'confirm', 'submit'] as const;
export type DraftActionKind = (typeof DRAFT_ACTIONS)[number];

/** What the model wants done to the ticket draft this turn; null fields stay as they are. */
export const DraftOutputSchema = z.object({
  action: z.enum(DRAFT_ACTIONS),
  category: z.enum(TICKET_CATEGORIES).nullable(),
  bookId: z.string().nullable(),
  subject: z.string().nullable(),
  description: z.string().nullable(),
});
export type DraftOutput = z.infer<typeof DraftOutputSchema>;

export interface DraftPatchFields {
  category?: TicketCategory;
  bookId?: string;
  subject?: string;
  description?: string;
}

export interface DraftAction {
  kind: DraftActionKind;
  patch: DraftPatchFields;
}

const clip = (text: string, max: number) => text.slice(0, max).trim();

/**
 * Makes model-proposed field values safe before they reach the draft: text is cleaned (HTML and
 * control characters removed) and cut to the ticket limits, empty text is dropped, and a book
 * that is not one of this author's books is ignored. Shared by chat and voice.
 */
export function cleanDraftFields(
  fields: {
    category?: TicketCategory | null;
    bookId?: string | null;
    subject?: string | null;
    description?: string | null;
  },
  books: readonly { id: string }[],
): DraftPatchFields {
  const patch: DraftPatchFields = {};
  if (fields.category) patch.category = fields.category;
  if (fields.bookId && books.some((b) => b.id === fields.bookId)) patch.bookId = fields.bookId;
  const subject = fields.subject ? clip(sanitizeText(fields.subject), SUBJECT_LIMITS.max) : '';
  if (subject) patch.subject = subject;
  const description = fields.description
    ? clip(sanitizeText(fields.description), DESCRIPTION_LIMITS.max)
    : '';
  if (description) patch.description = description;
  return patch;
}

/** The model's draft output as a safe action. Sending never carries edits: they would cancel it. */
export function toDraftAction(out: DraftOutput, books: readonly { id: string }[]): DraftAction {
  if (out.action === 'none' || out.action === 'submit') return { kind: out.action, patch: {} };
  return { kind: out.action, patch: cleanDraftFields(out, books) };
}

/** An answer that failed the fact check is replaced, so it can't ask "shall I send it?". */
export function withoutSending(action: DraftAction): DraftAction {
  return action.kind === 'confirm' || action.kind === 'submit'
    ? { kind: 'update', patch: action.patch }
    : action;
}
