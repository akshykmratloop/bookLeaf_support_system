import { z } from 'zod';
import { pageOf } from './common.js';
import { TICKET_DRAFT_STATUSES, TicketDraftSchema } from './ticket-drafts.js';
import { TranscriptLineSchema } from './voice.js';

/** An author's past conversations: chats and calls, newest first. Read-only. */
export const CONVERSATION_KINDS = ['CHAT', 'CALL'] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

const TicketRefSchema = z.object({ id: z.uuid(), number: z.string() });

export const ConversationSummarySchema = z.object({
  kind: z.enum(CONVERSATION_KINDS),
  /** A chat's id, or a call thread's id (the first call of a continued call). */
  id: z.uuid(),
  startedAt: z.iso.datetime(),
  /** The ticket subject if one was drafted, otherwise the author's first words. */
  title: z.string(),
  messageCount: z.int().min(0),
  ticket: TicketRefSchema.nullable(),
  draftStatus: z.enum(TICKET_DRAFT_STATUSES).nullable(),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const ConversationListQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ConversationListQuery = z.input<typeof ConversationListQuerySchema>;

export const ConversationPageSchema = pageOf(ConversationSummarySchema);
export type ConversationPage = z.infer<typeof ConversationPageSchema>;

/** One past conversation, opened: every line in order plus the ticket draft it produced. */
export const ConversationDetailSchema = z.object({
  kind: z.enum(CONVERSATION_KINDS),
  id: z.uuid(),
  startedAt: z.iso.datetime(),
  lines: z.array(TranscriptLineSchema),
  draft: TicketDraftSchema.nullable(),
  ticket: TicketRefSchema.nullable(),
});
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;
