import type { KnowledgeCategory } from '../knowledge/knowledge.js';

const MIN_WORD = 4;
/** Words too common to tell categories apart. */
const IGNORED = new Set([
  'about',
  'anything',
  'customer',
  'from',
  'have',
  'other',
  'question',
  'questions',
  'request',
  'such',
  'that',
  'their',
  'there',
  'this',
  'when',
  'with',
  'your',
]);

/** "refunds" and "refund" count as the same word (a plain trailing s is dropped). */
const stem = (w: string) => (w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

const wordsOf = (text: string) =>
  new Set(
    (text.toLowerCase().match(/\p{L}[\p{L}\p{N}]*/gu) ?? [])
      .filter((w) => w.length >= MIN_WORD && !IGNORED.has(w))
      .map(stem),
  );

/**
 * No-AI fallback for a workspace's own categories: the category whose label and description
 * share the most words with the ticket. Null when no category shares a word.
 */
export function scoreByWords(
  text: string,
  categories: readonly KnowledgeCategory[],
): { category: KnowledgeCategory; matched: string[] } | null {
  const ticket = wordsOf(text);
  let best: { category: KnowledgeCategory; matched: string[] } | null = null;
  for (const category of categories) {
    const matched = [...wordsOf(`${category.label} ${category.description}`)].filter((w) =>
      ticket.has(w),
    );
    if (matched.length > (best?.matched.length ?? 0)) best = { category, matched };
  }
  return best;
}
