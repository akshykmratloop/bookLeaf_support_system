import type { Fact } from '@bookleaf/shared';

/** Policy numbers from the BookLeaf Knowledge Base. Drafts may quote these without a record. */
export const PAYOUT_THRESHOLD_PAISE = 100_000;

interface KbEntry {
  id: string;
  label: string;
  display: string;
  section: string;
  type: Fact['type'];
  value: number | string;
}

const kb = ({ id, label, display, section, type, value }: KbEntry): Fact => ({
  id,
  label,
  type,
  value,
  display,
  source: { kind: 'KB', section, rule: label },
});

export const KB_FACTS: readonly Fact[] = [
  kb({
    id: 'kb.payout_threshold',
    label: 'Minimum payout threshold',
    display: '₹1,000',
    section: 'Royalty Policy',
    type: 'MONEY',
    value: PAYOUT_THRESHOLD_PAISE,
  }),
  kb({
    id: 'kb.payout_window',
    label: 'Payout window after quarter end',
    display: '45 days',
    section: 'Royalty Policy',
    type: 'DURATION',
    value: '45 days',
  }),
  kb({
    id: 'kb.royalty_split_author',
    label: 'Author share of net profit',
    display: '80%',
    section: 'Royalty Policy',
    type: 'PERCENT',
    value: 80,
  }),
  kb({
    id: 'kb.royalty_split_bookleaf',
    label: 'BookLeaf share of net profit',
    display: '20%',
    section: 'Royalty Policy',
    type: 'PERCENT',
    value: 20,
  }),
  kb({
    id: 'kb.escalation_window',
    label: 'Escalation response time',
    display: '48 hours',
    section: 'Communication Tone',
    type: 'DURATION',
    value: '48 hours',
  }),
  kb({
    id: 'kb.resync_window',
    label: 'Distribution re-sync time',
    display: '24–48 hours',
    section: 'Distribution & Availability',
    type: 'DURATION',
    value: '24-48 hours',
  }),
  kb({
    id: 'kb.listing_window',
    label: 'New listing go-live time',
    display: '7–10 business days',
    section: 'Distribution & Availability',
    type: 'DURATION',
    value: '7-10 business days',
  }),
  kb({
    id: 'kb.print_turnaround',
    label: 'Print / reprint turnaround',
    display: '5–7 business days',
    section: 'Printing & Quality',
    type: 'DURATION',
    value: '5-7 business days',
  }),
  kb({
    id: 'kb.metadata_update',
    label: 'Metadata update reflection time',
    display: '3–5 business days',
    section: 'General',
    type: 'DURATION',
    value: '3-5 business days',
  }),
];
