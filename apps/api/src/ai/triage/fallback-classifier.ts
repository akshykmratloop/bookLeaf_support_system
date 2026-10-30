import type { Priority } from '@bookleaf/shared';
import {
  fallbackCategory,
  type KnowledgeCategory,
  type WorkspaceKnowledge,
} from '../knowledge/knowledge.js';
import { scoreByWords } from './word-match.js';

/**
 * BookLeaf's keyword lists (publishing pack), used when AI is unavailable. Simple, explainable
 * scoring; always marked for review. Only categories still active in the workspace count.
 */
const KEYWORDS: Readonly<Record<string, RegExp[]>> = {
  ROYALTY_PAYMENTS: [
    /royalt/i,
    /payout/i,
    /\bpaid\b/i,
    /payment/i,
    /\bbank\b/i,
    /₹|\brs\.?\s?\d/i,
    /earning/i,
  ],
  ISBN_METADATA: [
    /\bisbn\b/i,
    /metadata/i,
    /\bdescription\b/i,
    /author name/i,
    /wrong (title|price)/i,
  ],
  PRINTING_QUALITY: [
    /print/i,
    /blurr?y/i,
    /misalign/i,
    /binding/i,
    /defect/i,
    /reprint/i,
    /author copies/i,
    /damaged/i,
  ],
  DISTRIBUTION_AVAILABILITY: [
    /unavailable/i,
    /not (listed|available|showing)/i,
    /amazon/i,
    /flipkart/i,
    /out of stock/i,
    /listing/i,
  ],
  BOOK_STATUS_PRODUCTION: [
    /typesetting/i,
    /proofread/i,
    /cover design/i,
    /editing/i,
    /\bstage\b/i,
    /when will .*(done|ready|published)/i,
    /production/i,
  ],
};

export interface KeywordClassification {
  /** Null only when the workspace has no active category. */
  category: string | null;
  priority: Priority;
  matched: string[];
}

interface Best {
  category: KnowledgeCategory | null;
  matched: string[];
}

function bookleafKeywords(text: string, k: WorkspaceKnowledge): Best {
  let best: Best = { category: fallbackCategory(k), matched: [] };
  for (const category of k.categories) {
    const patterns = KEYWORDS[category.key] ?? [];
    const hits = patterns.map((p) => text.match(p)?.[0]).filter((m): m is string => Boolean(m));
    if (hits.length > best.matched.length) best = { category, matched: hits };
  }
  return best;
}

/** BookLeaf's keyword lists, or for any other workspace its categories' own words. */
export function classifyByKeywords(text: string, k: WorkspaceKnowledge): KeywordClassification {
  const best = k.publishingPack
    ? bookleafKeywords(text, k)
    : (scoreByWords(text, k.categories) ?? { category: fallbackCategory(k), matched: [] });
  return {
    category: best.category?.key ?? null,
    priority: best.category?.defaultPriority ?? 'MEDIUM',
    matched: best.matched,
  };
}
