import { formatDate, formatInr, STAGE_LABELS, type HostDetail } from '@bookleaf/shared';
import type { AuthorRecord, BookRecord } from './facts/index.js';

const money = (paise: number | null, unknown: string) =>
  paise === null ? unknown : formatInr(paise);
const date = (iso: string | null, unknown: string) => (iso === null ? unknown : formatDate(iso));

/** The ten book fields BookLeaf shows authors, worded for people (unknown is never ₹0). */
export function bookDetails(b: BookRecord): HostDetail[] {
  const live = b.stage === 'PUBLISHED_LIVE';
  return [
    { label: 'ISBN', display: b.isbn },
    { label: 'Genre', display: b.genre },
    { label: 'Published', display: date(b.publicationDate, 'Not yet') },
    { label: 'Status', display: live ? 'Published' : `In production · ${STAGE_LABELS[b.stage]}` },
    { label: 'MRP', display: money(b.mrpPaise, 'Set at publication') },
    { label: 'Copies sold', display: b.copiesSold.toLocaleString('en-IN') },
    { label: 'Royalty earned', display: formatInr(b.royaltyEarnedPaise) },
    { label: 'Royalty paid', display: formatInr(b.royaltyPaidPaise) },
    { label: 'Royalty pending', display: formatInr(b.royaltyPendingPaise) },
    { label: 'Last payout', display: date(b.lastPayoutDate, live ? 'None yet' : '—') },
  ];
}

const total = (author: AuthorRecord, pick: (b: BookRecord) => number) =>
  formatInr(author.books.reduce((sum, b) => sum + pick(b), 0));

/** Account totals shown above the book list. */
export const accountDetails = (author: AuthorRecord): HostDetail[] => [
  { label: 'Royalty earned', display: total(author, (b) => b.royaltyEarnedPaise) },
  { label: 'Royalty paid', display: total(author, (b) => b.royaltyPaidPaise) },
  { label: 'Royalty pending', display: total(author, (b) => b.royaltyPendingPaise) },
];
