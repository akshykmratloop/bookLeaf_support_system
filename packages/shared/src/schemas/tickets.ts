import { z } from 'zod';
import {
  AI_JOB_STATUSES,
  AI_STATES,
  FIELD_SOURCES,
  MESSAGE_KINDS,
  PRIORITIES,
  TICKET_SOURCES,
  TICKET_STATUSES,
} from '../enums.js';
import { cleanText } from '../sanitize.js';
import { CategoryKeySchema } from './categories.js';

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

export const ACTIVITY_PARTIES = ['YOU', 'TEAM'] as const;
export type ActivityParty = (typeof ACTIVITY_PARTIES)[number];

/** The latest public message (or the request itself), as a short preview. */
export const LastActivitySchema = z.object({
  from: z.enum(ACTIVITY_PARTIES),
  at: z.iso.datetime(),
  preview: z.string(),
});
export type LastActivity = z.infer<typeof LastActivitySchema>;

/**
 * What an author sees: the requester view (like Zendesk's Requests API). The issue type and
 * channel are shown; priority, SLA, assignee, AI data and internal notes never are.
 */
export const AuthorTicketSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  subject: z.string(),
  description: z.string(),
  status: z.enum(TICKET_STATUSES),
  /** The workspace category's key and label (null: not categorised yet). */
  category: z.string().nullable(),
  categoryLabel: z.string().nullable(),
  /** Where the ticket was raised: the ticket form, a chat or a call. */
  channel: z.enum(TICKET_SOURCES),
  lastActivity: LastActivitySchema,
  /** The team answered last and the ticket is still open: the author's turn. */
  awaitingYou: z.boolean(),
  /** The author may mark it solved (open or in progress). */
  canSolve: z.boolean(),
  /** The author may still write on it: false once it is solved or closed (U-2). */
  canReply: z.boolean(),
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
  category: z.string().nullable(),
  categoryLabel: z.string().nullable(),
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

/** Queue order: most urgent first (the default), or by age. */
export const TICKET_SORTS = ['urgency', 'oldest', 'newest'] as const;
export type TicketSort = (typeof TICKET_SORTS)[number];

/** "Area/Location" style IANA names (and "UTC"); offsets like "+05:30" are not zone names. */
const ZONE_NAME = /^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/;

let timeZones: Set<string> | undefined;

/**
 * A time zone name this runtime knows. Intl.supportedValuesOf lists ICU's canonical names, which
 * are sometimes the older ones ("Asia/Calcutta", not "Asia/Kolkata"), so a name it does not list
 * is still accepted when Intl.DateTimeFormat resolves it.
 */
export function isTimeZone(tz: string): boolean {
  if (!ZONE_NAME.test(tz)) return false;
  timeZones ??= new Set(Intl.supportedValuesOf('timeZone'));
  if (tz === 'UTC' || timeZones.has(tz)) return true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false; // RangeError: not a time zone name. A validation answer, not a failure.
  }
}

export const TicketListQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  category: CategoryKeySchema.optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignee: z.enum(['me', 'unassigned']).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  /** The viewer's time zone: `from` and `to` are calendar days there. */
  tz: z.string().max(64).refine(isTimeZone, 'Unknown time zone').default('UTC'),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(TICKET_SORTS).default('urgency'),
  /** Opaque: the `nextCursor` of the previous page, for the same sort. */
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type TicketListQuery = z.input<typeof TicketListQuerySchema>;

export const UpdateTicketRequestSchema = z
  .object({
    version: z.int().min(0),
    status: z.enum(TICKET_STATUSES).optional(),
    /** One of the workspace's active categories. */
    category: CategoryKeySchema.optional(),
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
