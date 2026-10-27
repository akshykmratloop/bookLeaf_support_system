import type { CustomerFieldInput } from '@bookleaf/shared';
import { PAYOUT_ELIGIBILITY, ROYALTY_STATUSES } from '@bookleaf/shared';

/**
 * BookLeaf's customer-data schema as seed data for the default workspace. These are the
 * fact ids the BookLeaf domain pack reads by name (packages/shared/src/fact-ids.ts), written
 * the way any workspace would define its own fields in the UI.
 */
export const BOOKLEAF_FIELDS: readonly CustomerFieldInput[] = [
  {
    key: 'author.total_pending',
    label: 'Total royalty pending',
    type: 'MONEY',
    description: 'Royalty earned across all books and not yet paid out. Use for payout answers.',
    position: 10,
  },
  {
    key: 'author.payout_eligibility',
    label: 'Payout eligibility',
    type: 'STATUS',
    description: 'Whether the pending total has reached the minimum payout threshold.',
    allowedValues: [...PAYOUT_ELIGIBILITY],
    position: 20,
  },
  {
    key: 'payout.next_cycle_deadline',
    label: 'Next payout deadline',
    type: 'DATE',
    description: 'The date by which the next royalty payout is due.',
    position: 30,
  },
  {
    key: 'book.{id}.royalty_pending',
    label: 'Royalty pending (per book)',
    type: 'MONEY',
    description: 'Royalty earned on this book and not yet paid.',
    position: 40,
  },
  {
    key: 'book.{id}.royalty_status',
    label: 'Royalty status (per book)',
    type: 'STATUS',
    description:
      'NOTHING_PENDING, BELOW_THRESHOLD (rolls over), POSSIBLY_OVERDUE (no payout recorded after a deadline), SCHEDULED.',
    allowedValues: [...ROYALTY_STATUSES],
    position: 50,
  },
  {
    key: 'book.{id}.stage',
    label: 'Production stage (per book)',
    type: 'STATUS',
    description: 'Where the book is in production, from Manuscript Received to Published & Live.',
    allowedValues: [
      'MANUSCRIPT_RECEIVED',
      'EDITING',
      'COVER_DESIGN',
      'TYPESETTING',
      'PROOFREADING',
      'ISBN_ASSIGNMENT',
      'PRINTING',
      'DISTRIBUTION_SETUP',
      'PUBLISHED_LIVE',
    ],
    position: 60,
  },
  {
    key: 'book.{id}.isbn',
    label: 'ISBN (per book)',
    type: 'TEXT',
    description: 'The ISBN BookLeaf assigned to this book.',
    position: 70,
  },
];
