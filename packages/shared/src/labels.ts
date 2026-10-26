import type { BookStage, Priority, TicketCategory, TicketStatus } from './enums.js';

/** Human-readable labels. Kept next to the enums so UI and API messages always agree. */
export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: 'Royalty & Payments',
  ISBN_METADATA: 'ISBN & Metadata Issues',
  PRINTING_QUALITY: 'Printing & Quality',
  DISTRIBUTION_AVAILABILITY: 'Distribution & Availability',
  BOOK_STATUS_PRODUCTION: 'Book Status & Production Updates',
  GENERAL_INQUIRY: 'General Inquiry',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const STAGE_LABELS: Record<BookStage, string> = {
  MANUSCRIPT_RECEIVED: 'Manuscript Received',
  EDITING: 'Editing',
  COVER_DESIGN: 'Cover Design',
  TYPESETTING: 'Typesetting',
  PROOFREADING: 'Proofreading',
  ISBN_ASSIGNMENT: 'ISBN Assignment',
  PRINTING: 'Printing',
  DISTRIBUTION_SETUP: 'Distribution Setup',
  PUBLISHED_LIVE: 'Published & Live',
};

/** Priority rank: lower number = more urgent. Used for sorting and for "max" of two priorities. */
export const PRIORITY_RANK: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
