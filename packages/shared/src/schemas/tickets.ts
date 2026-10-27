import { z } from 'zod';
import {
  AI_JOB_STATUSES,
  AI_STATES,
  FIELD_SOURCES,
  MESSAGE_KINDS,
  PRIORITIES,
  TICKET_CATEGORIES,
  TICKET_SOURCES,
  TICKET_STATUSES,
} from '../enums.js';
import { cleanText } from '../sanitize.js';

export const SUBJECT_LIMITS = { min: 5, max: 150 } as const;
export const DESCRIPTION_LIMITS = { min: 20, max: 4000 } as const;
export const MESSAGE_LIMITS = { min: 1, max: 4000 } as const;

export const CreateTicketRequestSchema = z.object({
  bookId: z.uuid().nullable(),
  subject: cleanText(SUBJECT_LIMITS.min, SUBJECT_LIMITS.max),
  description: cleanText(DESCRIPTION_LIMITS.min, DESCRIPTION_LIMITS.max),
});
export type CreateTicketRequest = z.input<typeof CreateTicketRequestSchema>;

export const TicketMessageSchema = z.object({
  id: z.uuid(),
  kind: z.enum(MESSAGE_KINDS),
  body: z.string(),
  senderName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type TicketMessage = z.infer<typeof TicketMessageSchema>;

const BookRefSchema = z.object({ id: z.uuid(), title: z.string() }).nullable();
const PersonRefSchema = z.object({ id: z.uuid(), name: z.string() });

/** What an author sees: no category, priority, assignee, AI data or internal notes. */
export const AuthorTicketSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  subject: z.string(),
  description: z.string(),
  status: z.enum(TICKET_STATUSES),
  book: BookRefSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  messages: z.array(TicketMessageSchema),
});
export type AuthorTicket = z.infer<typeof AuthorTicketSchema>;

export const AuthorTicketListItemSchema = AuthorTicketSchema.omit({
  description: true,
  messages: true,
}).extend({ replyCount: z.int() });
export type AuthorTicketListItem = z.infer<typeof AuthorTicketListItemSchema>;

export const AdminTicketListItemSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  subject: z.string(),
  status: z.enum(TICKET_STATUSES),
  category: z.enum(TICKET_CATEGORIES).nullable(),
  categorySource: z.enum(FIELD_SOURCES).nullable(),
  priority: z.enum(PRIORITIES),
  prioritySource: z.enum(FIELD_SOURCES),
  aiState: z.enum(AI_STATES),
  needsReview: z.boolean(),
  slaDueAt: z.iso.datetime(),
  firstResponseAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  author: PersonRefSchema,
  assignee: PersonRefSchema.nullable(),
  book: BookRefSchema,
});
export type AdminTicketListItem = z.infer<typeof AdminTicketListItemSchema>;

export const AiJobSummarySchema = z.object({
  kind: z.string(),
  status: z.enum(AI_JOB_STATUSES),
  attempts: z.int(),
  maxAttempts: z.int(),
  lastErrorCode: z.string().nullable(),
});

export const AdminTicketSchema = AdminTicketListItemSchema.extend({
  description: z.string(),
  priorityReasons: z.array(z.string()),
  needsInfo: z.array(z.string()),
  aiConfidence: z.number().nullable(),
  version: z.int(),
  messages: z.array(TicketMessageSchema),
  aiJobs: z.array(AiJobSummarySchema),
  source: z.enum(TICKET_SOURCES),
  chatSessionId: z.uuid().nullable(),
  voiceSessionId: z.uuid().nullable(),
});
export type AdminTicket = z.infer<typeof AdminTicketSchema>;

export const TicketListQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignee: z.enum(['me', 'unassigned']).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type TicketListQuery = z.input<typeof TicketListQuerySchema>;

export const UpdateTicketRequestSchema = z
  .object({
    version: z.int().min(0),
    status: z.enum(TICKET_STATUSES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assigneeId: z.uuid().nullable().optional(),
  })
  .refine((v) => [v.status, v.category, v.priority, v.assigneeId].some((f) => f !== undefined), {
    message: 'Provide at least one field to update',
  });
export type UpdateTicketRequest = z.infer<typeof UpdateTicketRequestSchema>;

export const CreateMessageRequestSchema = z.object({
  body: cleanText(MESSAGE_LIMITS.min, MESSAGE_LIMITS.max),
  /** Admins choose REPLY (visible to the author) or INTERNAL_NOTE. Ignored for authors. */
  kind: z.enum(['REPLY', 'INTERNAL_NOTE']).optional(),
  /** Required to send a reply that the checker blocked on figures (never for placeholders). */
  overrideReason: cleanText(5, 500).optional(),
});
export type CreateMessageRequest = z.input<typeof CreateMessageRequestSchema>;
