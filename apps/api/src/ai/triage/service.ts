import type { Priority, TicketCategory } from '@bookleaf/shared';
import type { BookRoyaltyStatus } from '../facts/index.js';
import {
  TRIAGE_PROMPT_VERSION,
  TRIAGE_SYSTEM,
  TriageOutputSchema,
  triageUserMessage,
} from '../prompts/triage.v1.js';
import type { LlmProvider, StructuredResult } from '../providers/types.js';
import { classifyByKeywords } from './fallback-classifier.js';
import { higherPriority, priorityFloor } from './rules.js';

export interface TriageInput {
  subject: string;
  description: string;
  bookTitle: string | null;
  bookStage: string | null;
  royaltyStatus: BookRoyaltyStatus | null;
}

export interface TriageDecision {
  category: TicketCategory;
  priority: Priority;
  priorityReasons: string[];
  needsInfo: string[];
  /** Self-reported, not calibrated: used only to decide the "review suggested" badge. */
  confidence: number;
  source: 'AI' | 'RULES';
  needsReview: boolean;
}

export interface AiTriageRun {
  decision: TriageDecision;
  run: Omit<StructuredResult<unknown>, 'data'>;
  promptVersion: string;
}

/** Status labels only: triage does not need amounts. */
const ROYALTY_RECORD: Record<BookRoyaltyStatus, string> = {
  NOTHING_PENDING: 'nothing pending on this book',
  BELOW_THRESHOLD:
    "author's total pending is below the payout threshold, so it rolls over to the next quarter (not overdue)",
  POSSIBLY_OVERDUE: 'possibly overdue: no payout recorded although a payout deadline has passed',
  SCHEDULED: 'pending amount is due in the next payout cycle',
};

const CONFIDENCE = { high: 0.9, medium: 0.6, low: 0.3 } as const;
const REVIEW_BELOW = 0.5;
const MAX_LIST = 3;
const MAX_ITEM_CHARS = 160;

const tidy = (items: string[]) =>
  items
    .slice(0, MAX_LIST)
    .map((s) => s.trim().slice(0, MAX_ITEM_CHARS))
    .filter(Boolean);
const ticketText = (i: TriageInput) => `${i.subject}\n${i.description}`;

/** Calls the model. Throws AiError subclasses; the job worker decides whether to retry or fall back. */
export async function runAiTriage(
  provider: LlmProvider,
  model: string,
  input: TriageInput,
): Promise<AiTriageRun> {
  const result = await provider.generateStructured({
    task: 'TRIAGE',
    model,
    stableSystem: TRIAGE_SYSTEM,
    user: triageUserMessage({
      ...input,
      royaltyRecord: input.royaltyStatus ? ROYALTY_RECORD[input.royaltyStatus] : null,
    }),
    schema: TriageOutputSchema,
    maxTokens: 400,
    effort: 'low',
  });
  const out = result.data;
  const floor = priorityFloor({
    text: ticketText(input),
    category: out.category,
    royaltyStatus: input.royaltyStatus,
  });
  const priority = higherPriority(out.priority, floor.floor);
  const confidence = CONFIDENCE[out.confidence];
  const raisedByRules = priority !== out.priority;
  const decision: TriageDecision = {
    category: out.category,
    priority,
    priorityReasons: tidy([...floor.reasons, ...out.priorityReasons]),
    needsInfo: tidy(out.needsInfo),
    confidence,
    source: 'AI',
    needsReview: confidence < REVIEW_BELOW || raisedByRules,
  };
  const { data: _data, ...run } = result;
  return { decision, run, promptVersion: TRIAGE_PROMPT_VERSION };
}

/** No AI: keyword category + rules floor. Always flagged for human review. */
export function fallbackTriage(input: TriageInput): TriageDecision {
  const text = ticketText(input);
  const guess = classifyByKeywords(text);
  const floor = priorityFloor({
    text,
    category: guess.category,
    royaltyStatus: input.royaltyStatus,
  });
  return {
    category: guess.category,
    priority: higherPriority(guess.priority, floor.floor),
    priorityReasons: tidy([
      ...floor.reasons,
      guess.matched.length ? `Keywords: ${guess.matched.join(', ')}` : 'No clear keywords',
    ]),
    needsInfo: [],
    confidence: 0,
    source: 'RULES',
    needsReview: true,
  };
}
