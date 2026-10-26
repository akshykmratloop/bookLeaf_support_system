import type { TicketCategory } from '@bookleaf/shared';

/**
 * The BookLeaf Knowledge Base, split by section. A draft prompt receives only the section(s)
 * for its ticket's category plus tone guidelines — never the whole KB (cost + focus).
 */
export const KB_SECTIONS = {
  company: `Company Overview
- BookLeaf Publishing is a self-publishing company operating in India and the US.
- Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid, with marketing and distribution add-ons).
- BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management.
- In-house printing facility and warehouse in Delhi; print partners include Repro India and Epitome Books.`,
  royalty: `Royalty Policy
- 80/20 royalty split: 80% of the net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold: ₹1,000. If accumulated royalties are below this, they roll over to the next quarter.
- Payouts are made via bank transfer to the account linked in the author's dashboard.
- Authors can view a detailed royalty breakdown in their dashboard, showing sales figures per platform.`,
  isbn: `ISBN Policy
- Every book published through BookLeaf receives a unique ISBN assigned by BookLeaf.
- ISBNs are registered under BookLeaf's publisher imprint. An author who wants an ISBN under their own imprint must obtain it independently.
- An ISBN error (duplicate, wrong book linked) is a high-priority issue and is escalated to the production team.`,
  printing: `Printing & Quality
- In-house printing handles most orders. Overflow or specific formats go to Repro India or Epitome Books.
- Standard print turnaround: 5–7 business days from order confirmation.
- For a quality issue (misprints, binding defects, colour inconsistency), BookLeaf arranges a free reprint after verification. The author may need to share photos of the defective copy.`,
  distribution: `Distribution & Availability
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings typically go live within 7–10 business days after publication is complete.
- A book showing as unavailable on a platform usually indicates a stock sync issue; BookLeaf's team can trigger a re-sync within 24–48 hours.`,
  production: `Production Stages
- Stages: Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live.
- Authors are updated at each stage via email. Delays typically happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).`,
  general: `General
- Metadata updates (for example the book description) can be submitted through the dashboard or by emailing the BookLeaf team. Changes typically reflect on platforms within 3–5 business days.`,
  tone: `Communication Tone Guidelines
- Always empathetic and professional. Authors are partners, not customers to be managed.
- Acknowledge the author's concern before moving to solutions.
- Be specific: actual numbers, dates and statuses rather than vague reassurance.
- If something is BookLeaf's fault (delayed royalties, ISBN error), own it directly. No corporate deflection.
- If the issue needs escalation or investigation, give a clear timeline ("Our team will look into this and get back to you within 48 hours") rather than open-ended promises.
- Always end with a clear next step for the author and/or the BookLeaf team.`,
} as const;

export type KbSectionKey = keyof typeof KB_SECTIONS;

const SECTIONS_BY_CATEGORY: Record<TicketCategory, KbSectionKey[]> = {
  ROYALTY_PAYMENTS: ['royalty'],
  ISBN_METADATA: ['isbn', 'general'],
  PRINTING_QUALITY: ['printing'],
  DISTRIBUTION_AVAILABILITY: ['distribution'],
  BOOK_STATUS_PRODUCTION: ['production', 'distribution'],
  GENERAL_INQUIRY: ['company', 'general'],
};

export function kbSectionsFor(category: TicketCategory): KbSectionKey[] {
  return SECTIONS_BY_CATEGORY[category];
}

export function kbTextFor(category: TicketCategory): string {
  return kbSectionsFor(category)
    .map((k) => KB_SECTIONS[k])
    .join('\n\n');
}
