/** Domain enums shared by the API and the web app. Values are stable API contract strings. */

export const ROLES = ['AUTHOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = [
  'ROYALTY_PAYMENTS',
  'ISBN_METADATA',
  'PRINTING_QUALITY',
  'DISTRIBUTION_AVAILABILITY',
  'BOOK_STATUS_PRODUCTION',
  'GENERAL_INQUIRY',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const BOOK_STAGES = [
  'MANUSCRIPT_RECEIVED',
  'EDITING',
  'COVER_DESIGN',
  'TYPESETTING',
  'PROOFREADING',
  'ISBN_ASSIGNMENT',
  'PRINTING',
  'DISTRIBUTION_SETUP',
  'PUBLISHED_LIVE',
] as const;
export type BookStage = (typeof BOOK_STAGES)[number];

export const MESSAGE_KINDS = ['AUTHOR', 'REPLY', 'INTERNAL_NOTE', 'SYSTEM'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** Who set a ticket's category or priority. ADMIN values are never overwritten by AI. */
export const FIELD_SOURCES = ['AI', 'RULES', 'ADMIN'] as const;
export type FieldSource = (typeof FIELD_SOURCES)[number];

/** Overall AI processing state of a ticket, shown as a badge in the queue. */
export const AI_STATES = ['PENDING', 'DONE', 'FALLBACK'] as const;
export type AiState = (typeof AI_STATES)[number];

export const AI_JOB_STATUSES = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FALLBACK'] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export const DRAFT_SOURCES = ['AI', 'TEMPLATE'] as const;
export type DraftSource = (typeof DRAFT_SOURCES)[number];
