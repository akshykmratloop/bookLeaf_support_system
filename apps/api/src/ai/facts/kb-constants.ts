import type { Fact } from '@bookleaf/shared';

/** Policy numbers from the BookLeaf Knowledge Base. Drafts may quote these without a record. */
export const PAYOUT_THRESHOLD_PAISE = 100_000;

const kb = (id: string, label: string, display: string, section: string, type: Fact['type'], value: number | string): Fact => ({
  id,
  label,
  type,
  value,
  display,
  source: { kind: 'KB', section, rule: label },
});

export const KB_FACTS: readonly Fact[] = [
  kb('kb.payout_threshold', 'Minimum payout threshold', '₹1,000', 'Royalty Policy', 'MONEY', PAYOUT_THRESHOLD_PAISE),
  kb('kb.payout_window', 'Payout window after quarter end', '45 days', 'Royalty Policy', 'DURATION', '45 days'),
  kb('kb.royalty_split_author', 'Author share of net profit', '80%', 'Royalty Policy', 'PERCENT', 80),
  kb('kb.royalty_split_bookleaf', 'BookLeaf share of net profit', '20%', 'Royalty Policy', 'PERCENT', 20),
  kb('kb.escalation_window', 'Escalation response time', '48 hours', 'Communication Tone', 'DURATION', '48 hours'),
  kb('kb.resync_window', 'Distribution re-sync time', '24–48 hours', 'Distribution & Availability', 'DURATION', '24-48 hours'),
  kb('kb.listing_window', 'New listing go-live time', '7–10 business days', 'Distribution & Availability', 'DURATION', '7-10 business days'),
  kb('kb.print_turnaround', 'Print / reprint turnaround', '5–7 business days', 'Printing & Quality', 'DURATION', '5-7 business days'),
  kb('kb.metadata_update', 'Metadata update reflection time', '3–5 business days', 'General', 'DURATION', '3-5 business days'),
];
