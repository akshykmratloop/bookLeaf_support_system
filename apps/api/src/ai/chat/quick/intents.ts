/** Common questions answered straight from the author's records, without the AI. */
export const QUICK_INTENTS = [
  'GREETING',
  'THANKS',
  'NEXT_PAYOUT',
  'PENDING_ROYALTY',
  'BOOK_STAGE',
] as const;
export type QuickIntent = (typeof QUICK_INTENTS)[number];

/** Longer messages usually carry detail that needs the AI. */
const MAX_QUICK_CHARS = 120;

/**
 * Signs of a problem, a complaint or a request for action. Those need the AI, which can show
 * empathy and offer a ticket, so they never take the quick path.
 */
const NEEDS_CARE =
  /\b(why|not|no|never|wrong|missing|incorrect|issue|problem|fix|change|update|refund|dispute|complain\w*|error|delay\w*|late|still|stuck|help|cancel\w*|less|low|only)\b|n't\b/;

const GREETING =
  /^(hi+|hello|hey|hiya|namaste|good (morning|afternoon|evening))( there| bookleaf| team)?$/;
const THANKS = /^((ok|okay|great|cool) )?(thanks|thank you|thx|ty)( so much| a lot| bookleaf)?$/;
const NEXT_PAYOUT =
  /\bnext payout\b|\bpayout (date|cycle)\b|\bwhen\b.*\b(payout|paid|pay me|payment)\b/;
const PENDING = /\b(pending|due|owed|outstanding)\b/;
const MONEY = /\b(royalt(y|ies)|amount|money|payment|earnings?)\b/;
const STAGE = /\b(stage|status)\b/;
const BOOK = /\bbooks?\b/;
const NOT_STAGE = /\b(royalt(y|ies)|payout|payment|ticket)\b/;

/** Lower case, no punctuation (apostrophes kept for "n't"), single spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The quick intent of a message, or null when the AI should answer it. */
export function detectQuickIntent(message: string): QuickIntent | null {
  const t = normalize(message);
  if (!t || t.length > MAX_QUICK_CHARS) return null;
  if (GREETING.test(t)) return 'GREETING';
  if (THANKS.test(t)) return 'THANKS';
  if (NEEDS_CARE.test(t)) return null;
  return recordIntent(t);
}

/** Questions answered straight from the author's records. */
function recordIntent(t: string): QuickIntent | null {
  if (NEXT_PAYOUT.test(t)) return 'NEXT_PAYOUT';
  if (isPendingQuestion(t)) return 'PENDING_ROYALTY';
  if (isStageQuestion(t)) return 'BOOK_STAGE';
  return null;
}

const isPendingQuestion = (t: string) =>
  (PENDING.test(t) && MONEY.test(t)) || /\bhow much royalt/.test(t);

const isStageQuestion = (t: string) => STAGE.test(t) && BOOK.test(t) && !NOT_STAGE.test(t);
