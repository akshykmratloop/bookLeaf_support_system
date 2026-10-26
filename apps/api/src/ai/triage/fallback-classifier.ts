import type { Priority, TicketCategory } from '@bookleaf/shared';

/** Used when AI is unavailable. Simple, explainable keyword scoring; always marked for review. */
const KEYWORDS: Record<Exclude<TicketCategory, 'GENERAL_INQUIRY'>, RegExp[]> = {
  ROYALTY_PAYMENTS: [/royalt/i, /payout/i, /\bpaid\b/i, /payment/i, /\bbank\b/i, /₹|\brs\.?\s?\d/i, /earning/i],
  ISBN_METADATA: [/\bisbn\b/i, /metadata/i, /\bdescription\b/i, /author name/i, /wrong (title|price)/i],
  PRINTING_QUALITY: [/print/i, /blurr?y/i, /misalign/i, /binding/i, /defect/i, /reprint/i, /author copies/i, /damaged/i],
  DISTRIBUTION_AVAILABILITY: [/unavailable/i, /not (listed|available|showing)/i, /amazon/i, /flipkart/i, /out of stock/i, /listing/i],
  BOOK_STATUS_PRODUCTION: [/typesetting/i, /proofread/i, /cover design/i, /editing/i, /\bstage\b/i, /when will .*(done|ready|published)/i, /production/i],
};

const DEFAULT_PRIORITY: Record<TicketCategory, Priority> = {
  ROYALTY_PAYMENTS: 'MEDIUM',
  ISBN_METADATA: 'HIGH',
  PRINTING_QUALITY: 'MEDIUM',
  DISTRIBUTION_AVAILABILITY: 'MEDIUM',
  BOOK_STATUS_PRODUCTION: 'MEDIUM',
  GENERAL_INQUIRY: 'LOW',
};

export interface KeywordClassification {
  category: TicketCategory;
  priority: Priority;
  matched: string[];
}

export function classifyByKeywords(text: string): KeywordClassification {
  let best: TicketCategory = 'GENERAL_INQUIRY';
  let bestScore = 0;
  let matched: string[] = [];
  for (const [category, patterns] of Object.entries(KEYWORDS) as [TicketCategory, RegExp[]][]) {
    const hits = patterns.map((p) => text.match(p)?.[0]).filter((m): m is string => Boolean(m));
    if (hits.length > bestScore) {
      best = category;
      bestScore = hits.length;
      matched = hits;
    }
  }
  return { category: best, priority: DEFAULT_PRIORITY[best], matched };
}
