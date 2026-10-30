import { DESCRIPTION_LIMITS, SUBJECT_LIMITS, sanitizeText } from '@bookleaf/shared';
import { z } from 'zod';
import { categoryOf, type WorkspaceKnowledge } from '../knowledge/knowledge.js';

export const DRAFT_ACTIONS = ['none', 'update', 'confirm', 'submit'] as const;
export type DraftActionKind = (typeof DRAFT_ACTIONS)[number];

/** What the model wants done to the ticket draft this turn; null fields stay as they are. */
export const DraftOutputSchema = z.object({
  action: z.enum(DRAFT_ACTIONS),
  /** A key from ISSUE TYPES; anything else is ignored when applied. */
  category: z.string().nullable(),
  bookId: z.string().nullable(),
  subject: z.string().nullable(),
  description: z.string().nullable(),
});
export type DraftOutput = z.infer<typeof DraftOutputSchema>;

export interface DraftPatchFields {
  category?: string;
  bookId?: string;
  subject?: string;
  description?: string;
}

export interface DraftAction {
  kind: DraftActionKind;
  patch: DraftPatchFields;
}

const clip = (text: string, max: number) => text.slice(0, max).trim();

/** What a proposed field may point at: the author's books and the workspace's active categories. */
export interface DraftChoices {
  books: readonly { id: string }[];
  knowledge: WorkspaceKnowledge;
}

/**
 * Makes model-proposed field values safe before they reach the draft: text is cleaned (HTML and
 * control characters removed) and cut to the ticket limits, empty text is dropped, and a book or
 * category that is not one of this author's books or this workspace's active categories is
 * ignored. Shared by chat and voice.
 */
export function cleanDraftFields(
  fields: {
    category?: string | null;
    bookId?: string | null;
    subject?: string | null;
    description?: string | null;
  },
  { books, knowledge }: DraftChoices,
): DraftPatchFields {
  const patch: DraftPatchFields = {};
  const category = categoryOf(knowledge, fields.category);
  if (category) patch.category = category.key;
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
export function toDraftAction(out: DraftOutput, choices: DraftChoices): DraftAction {
  if (out.action === 'none' || out.action === 'submit') return { kind: out.action, patch: {} };
  return { kind: out.action, patch: cleanDraftFields(out, choices) };
}

/** An answer that failed the fact check is replaced, so it can't ask "shall I send it?". */
export function withoutSending(action: DraftAction): DraftAction {
  return action.kind === 'confirm' || action.kind === 'submit'
    ? { kind: 'update', patch: action.patch }
    : action;
}
