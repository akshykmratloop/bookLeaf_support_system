import { z } from 'zod';
import { cleanText } from '../sanitize.js';
import { CategoryKeySchema } from './categories.js';
import { DESCRIPTION_LIMITS, SUBJECT_LIMITS } from './tickets.js';

export const TICKET_DRAFT_STATUSES = ['OPEN', 'AWAITING_CONFIRMATION', 'SUBMITTED'] as const;
export type TicketDraftStatus = (typeof TICKET_DRAFT_STATUSES)[number];

export const DRAFT_EDITORS = ['AUTHOR', 'ASSISTANT'] as const;
export type DraftEditor = (typeof DRAFT_EDITORS)[number];

/** The ticket the author and the assistant prepare together, shown in the side panel. */
export const TicketDraftSchema = z.object({
  id: z.uuid(),
  /** A key of the workspace's categories (null: not chosen). */
  category: z.string().nullable(),
  bookId: z.uuid().nullable(),
  subject: z.string(),
  description: z.string(),
  status: z.enum(TICKET_DRAFT_STATUSES),
  version: z.int(),
  lastEditedBy: z.enum(DRAFT_EDITORS),
  /** Ready to send: subject and description meet the ticket minimums. */
  isComplete: z.boolean(),
  ticket: z.object({ id: z.uuid(), number: z.string() }).nullable(),
  updatedAt: z.iso.datetime(),
});
export type TicketDraft = z.infer<typeof TicketDraftSchema>;

/**
 * An edit to some fields. While typing, text may still be shorter than the ticket minimums, so
 * only the maximums apply here; the minimums are checked when the draft is sent.
 */
export const EditTicketDraftSchema = z
  .object({
    category: CategoryKeySchema.nullable().optional(),
    bookId: z.uuid().nullable().optional(),
    subject: cleanText(0, SUBJECT_LIMITS.max).optional(),
    description: cleanText(0, DESCRIPTION_LIMITS.max).optional(),
  })
  .refine((v) => Object.values(v).some((f) => f !== undefined), {
    message: 'Change at least one field',
  });
export type EditTicketDraft = z.input<typeof EditTicketDraftSchema>;

/** Sending: the version the author is looking at, so a just-changed draft is never sent blind. */
export const SubmitTicketDraftSchema = z.object({ version: z.int().min(0) });
export type SubmitTicketDraft = z.infer<typeof SubmitTicketDraftSchema>;

/** Discarding: empties the draft the author is looking at (never a version they have not seen). */
export const DiscardTicketDraftSchema = z.object({ version: z.int().min(0) });
export type DiscardTicketDraft = z.infer<typeof DiscardTicketDraftSchema>;
