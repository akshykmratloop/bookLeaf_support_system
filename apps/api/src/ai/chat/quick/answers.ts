import type { CheckResult, Fact } from '@bookleaf/shared';
import { checkReply } from '../../checker/index.js';
import { detectQuickIntent, type QuickIntent } from './intents.js';

export interface QuickAnswer {
  intent: QuickIntent;
  body: string;
  factIds: string[];
  check: CheckResult;
}

interface Ctx {
  firstName: string;
  facts: readonly Fact[];
}

interface Draft {
  body: string;
  facts: Fact[];
}

const find = (facts: readonly Fact[], id: string) => facts.find((f) => f.id === id) ?? null;
const perBook = (facts: readonly Fact[], suffix: string) =>
  facts.filter((f) => f.id.startsWith('book.') && f.id.endsWith(`.${suffix}`));
/** "Whispers of the Ganges: royalty pending" → "Whispers of the Ganges". */
const titleOf = (f: Fact) => f.label.split(': ')[0] ?? f.label;

function pendingRoyalty({ firstName, facts }: Ctx): Draft | null {
  const total = find(facts, 'author.total_pending');
  const books = perBook(facts, 'royalty_pending');
  if (!total || books.length === 0) return null;
  const lines = books.map((b) => `${titleOf(b)}: ${b.display}`).join('; ');
  const body =
    books.length === 1
      ? `${firstName}, you have ${total.display} in royalty pending on ${titleOf(books[0] as Fact)}.`
      : `${firstName}, you have ${total.display} in royalty pending in total. By book: ${lines}.`;
  return { body, facts: [total, ...books] };
}

function nextPayout({ firstName, facts }: Ctx): Draft | null {
  const deadline = find(facts, 'payout.next_cycle_deadline');
  const total = find(facts, 'author.total_pending');
  const eligibility = find(facts, 'author.payout_eligibility');
  const threshold = find(facts, 'kb.payout_threshold');
  if (!deadline || !total || !eligibility || !threshold) return null;
  const eligible = eligibility.value === 'ELIGIBLE';
  const status = eligible
    ? `which is above the ${threshold.display} minimum, so it is due in that cycle`
    : `which is below the ${threshold.display} minimum, so it rolls over until your total reaches it`;
  return {
    body: `${firstName}, the next payout cycle closes by ${deadline.display}. You have ${total.display} pending, ${status}.`,
    facts: [deadline, total, eligibility, threshold],
  };
}

function bookStage({ firstName, facts }: Ctx): Draft | null {
  const stages = perBook(facts, 'stage');
  if (stages.length === 0) return null;
  const lines = stages.map((s) => `${titleOf(s)} is ${s.display}`).join('; ');
  return { body: `${firstName}, here is where your books are: ${lines}.`, facts: stages };
}

const ANSWERS: Record<QuickIntent, (ctx: Ctx) => Draft | null> = {
  GREETING: ({ firstName }) => ({
    body: `Hi ${firstName}! I can help with your books, royalties and payouts. What would you like to know?`,
    facts: [],
  }),
  THANKS: ({ firstName }) => ({
    body: `You're welcome, ${firstName}. Anything else about your books or payouts?`,
    facts: [],
  }),
  PENDING_ROYALTY: pendingRoyalty,
  NEXT_PAYOUT: nextPayout,
  BOOK_STAGE: bookStage,
};

/**
 * Answers a common question in milliseconds from verified facts. Every figure comes from a fact
 * and the answer still passes the same checker as AI answers; anything else returns null and
 * goes to the AI.
 */
export function quickAnswer(
  message: string,
  ctx: Ctx & { ignorePhrases: string[] },
): QuickAnswer | null {
  const intent = detectQuickIntent(message);
  if (!intent) return null;
  const draft = ANSWERS[intent](ctx);
  if (!draft) return null;
  const claims = draft.facts.map((f) => ({ quote: f.display, factIds: [f.id] }));
  const check = checkReply({
    body: draft.body,
    facts: ctx.facts,
    claims,
    ignorePhrases: ctx.ignorePhrases,
  });
  if (!check.passed) return null;
  return { intent, body: draft.body, factIds: draft.facts.map((f) => f.id), check };
}
