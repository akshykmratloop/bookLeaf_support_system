import type { Priority } from '@bookleaf/shared';
import type { WorkspaceKnowledge } from '../../ai/knowledge/knowledge.js';
import { BOOKLEAF_TONE } from '../../ai/prompts/bookleaf-tone.js';

export interface CategorySeed {
  key: string;
  label: string;
  description: string;
  defaultPriority: Priority;
}

export interface ArticleSeed {
  title: string;
  body: string;
  categoryKeys: readonly string[];
}

/**
 * BookLeaf's six categories, as the default workspace's starting rows (S.9). The descriptions are
 * the triage prompt's category lines, so BookLeaf's triage prompt is unchanged. The migration
 * 20261030120000_workspace_categories_and_knowledge inserts the same rows.
 */
export const BOOKLEAF_CATEGORIES: readonly CategorySeed[] = [
  {
    key: 'ROYALTY_PAYMENTS',
    label: 'Royalty & Payments',
    description:
      'royalty amounts, missing or late payouts, payout dates, royalty calculation, bank transfer of royalties.',
    defaultPriority: 'MEDIUM',
  },
  {
    key: 'ISBN_METADATA',
    label: 'ISBN & Metadata Issues',
    description:
      'wrong, duplicate or mismatched ISBN; book metadata such as title, description, author name, price shown on a platform.',
    defaultPriority: 'HIGH',
  },
  {
    key: 'PRINTING_QUALITY',
    label: 'Printing & Quality',
    description:
      'physical print defects (blurry images, misaligned pages, binding, colour), author copies, reprints, print turnaround.',
    defaultPriority: 'MEDIUM',
  },
  {
    key: 'DISTRIBUTION_AVAILABILITY',
    label: 'Distribution & Availability',
    description:
      'book missing, "currently unavailable" or not listed on Amazon India, Flipkart, Amazon US, Amazon UK or the BookLeaf Store.',
    defaultPriority: 'MEDIUM',
  },
  {
    key: 'BOOK_STATUS_PRODUCTION',
    label: 'Book Status & Production Updates',
    description:
      'where a not-yet-published book is in production (editing, cover design, typesetting, proofreading, ISBN assignment, printing, distribution setup) and when it will be done.',
    defaultPriority: 'MEDIUM',
  },
  {
    key: 'GENERAL_INQUIRY',
    label: 'General Inquiry',
    description: 'anything else (packages, account, bio, how-to questions).',
    defaultPriority: 'LOW',
  },
];

/** The one category a new workspace starts with (its admins add their own). */
export const STARTER_CATEGORY: CategorySeed = {
  key: 'GENERAL_INQUIRY',
  label: 'General Inquiry',
  description: 'any question or request from a customer.',
  defaultPriority: 'MEDIUM',
};

/**
 * BookLeaf's knowledge base split into articles, each linked to the categories whose drafts used
 * that section before S.9. Order = the old section order, so the assistant reads the same text.
 */
export const BOOKLEAF_ARTICLES: readonly ArticleSeed[] = [
  {
    title: 'Company Overview',
    body: `- BookLeaf Publishing is a self-publishing company operating in India and the US.
- Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid, with marketing and distribution add-ons).
- BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management.
- In-house printing facility and warehouse in Delhi; print partners include Repro India and Epitome Books.`,
    categoryKeys: ['GENERAL_INQUIRY'],
  },
  {
    title: 'Royalty Policy',
    body: `- 80/20 royalty split: 80% of the net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold: ₹1,000. If accumulated royalties are below this, they roll over to the next quarter.
- Payouts are made via bank transfer to the account linked in the author's dashboard.
- Authors can view a detailed royalty breakdown in their dashboard, showing sales figures per platform.`,
    categoryKeys: ['ROYALTY_PAYMENTS'],
  },
  {
    title: 'ISBN Policy',
    body: `- Every book published through BookLeaf receives a unique ISBN assigned by BookLeaf.
- ISBNs are registered under BookLeaf's publisher imprint. An author who wants an ISBN under their own imprint must obtain it independently.
- An ISBN error (duplicate, wrong book linked) is a high-priority issue and is escalated to the production team.`,
    categoryKeys: ['ISBN_METADATA'],
  },
  {
    title: 'Printing & Quality',
    body: `- In-house printing handles most orders. Overflow or specific formats go to Repro India or Epitome Books.
- Standard print turnaround: 5–7 business days from order confirmation.
- For a quality issue (misprints, binding defects, colour inconsistency), BookLeaf arranges a free reprint after verification. The author may need to share photos of the defective copy.`,
    categoryKeys: ['PRINTING_QUALITY'],
  },
  {
    title: 'Distribution & Availability',
    body: `- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings typically go live within 7–10 business days after publication is complete.
- A book showing as unavailable on a platform usually indicates a stock sync issue; BookLeaf's team can trigger a re-sync within 24–48 hours.`,
    categoryKeys: ['DISTRIBUTION_AVAILABILITY', 'BOOK_STATUS_PRODUCTION'],
  },
  {
    title: 'Production Stages',
    body: `- Stages: Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live.
- Authors are updated at each stage via email. Delays typically happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).`,
    categoryKeys: ['BOOK_STATUS_PRODUCTION'],
  },
  {
    title: 'General',
    body: `- Metadata updates (for example the book description) can be submitted through the dashboard or by emailing the BookLeaf team. Changes typically reflect on platforms within 3–5 business days.`,
    categoryKeys: ['ISBN_METADATA', 'GENERAL_INQUIRY'],
  },
  { ...BOOKLEAF_TONE, categoryKeys: [] },
];

/** BookLeaf's knowledge exactly as seeded, without a database (evals and unit tests). */
export function bookleafKnowledge(): WorkspaceKnowledge {
  return {
    workspaceName: 'BookLeaf Publishing',
    publishingPack: true,
    categories: BOOKLEAF_CATEGORIES.map((c) => ({ ...c, slaHours: null })),
    articles: BOOKLEAF_ARTICLES,
  };
}
