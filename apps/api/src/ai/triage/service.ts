import type { Priority } from '@bookleaf/shared';
import type { RoyaltyStatus } from '@bookleaf/shared';
import { PRIORITY_RANK } from '@bookleaf/shared';
import { categoryKeysOf, categoryOf, type WorkspaceKnowledge } from '../knowledge/knowledge.js';
import {
  TRIAGE_PROMPT_VERSION,
  triageOutputSchema,
  type TriageOutput,
  triageSystem,
  triageUserMessage,
} from '../prompts/triage.v1.js';
import type { LlmProvider, StructuredResult } from '../providers/types.js';
import { classifyByKeywords } from './fallback-classifier.js';
import { higherPriority, priorityFloor } from './rules.js';
import { NoCategoriesError } from '../providers/errors.js';

export interface TriageInput {
  subject: string;
  description: string;
  bookTitle: string | null;
  bookStage: string | null;
  royaltyStatus: RoyaltyStatus | null;
}

export interface TriageDecision {
  /** One of the workspace's active category keys (null only when it has none). */
  category: string | null;
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
const ROYALTY_RECORD: Record<RoyaltyStatus, string> = {
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

/** The workspace's category keys as a non-empty tuple, or null when it has no active category. */
function keysOf(k: WorkspaceKnowledge): [string, ...string[]] | null {
  const [first, ...rest] = categoryKeysOf(k);
  return first === undefined ? null : [first, ...rest];
}

/** The model chose a priority above the category's usual one, with no rule to explain it. */
function raisedWithoutRule(k: WorkspaceKnowledge, out: TriageOutput, rulesFired: boolean) {
  const usual = categoryOf(k, out.category)?.defaultPriority;
  return !rulesFired && usual !== undefined && PRIORITY_RANK[out.priority] < PRIORITY_RANK[usual];
}

/** The model's answer with the business-rule priority floor applied on top. */
function aiDecision(input: TriageInput, out: TriageOutput, k: WorkspaceKnowledge): TriageDecision {
  const floor = priorityFloor({
    text: ticketText(input),
    category: out.category,
    royaltyStatus: input.royaltyStatus,
  });
  const priority = higherPriority(out.priority, floor.floor);
  const confidence = CONFIDENCE[out.confidence];
  const raisedByRules = priority !== out.priority;
  return {
    category: out.category,
    priority,
    priorityReasons: tidy([...floor.reasons, ...out.priorityReasons]),
    needsInfo: tidy(out.needsInfo),
    confidence,
    source: 'AI',
    needsReview:
      confidence < REVIEW_BELOW ||
      raisedByRules ||
      raisedWithoutRule(k, out, floor.reasons.length > 0),
  };
}

/**
 * Calls the model with the workspace's own categories. Throws AiError subclasses; the job worker
 * decides whether to retry or fall back. A workspace with no active category gets the fallback.
 */
export async function runAiTriage(
  provider: LlmProvider,
  model: string,
  input: TriageInput,
  knowledge: WorkspaceKnowledge,
): Promise<AiTriageRun> {
  const keys = keysOf(knowledge);
  if (!keys) throw new NoCategoriesError();
  const result = await provider.generateStructured({
    task: 'TRIAGE',
    model,
    stableSystem: triageSystem(knowledge),
    user: triageUserMessage({
      ...input,
      royaltyRecord: input.royaltyStatus ? ROYALTY_RECORD[input.royaltyStatus] : null,
    }),
    schema: triageOutputSchema(keys),
    maxTokens: 400,
    effort: 'low',
  });
  const decision = aiDecision(input, result.data, knowledge);
  const { data: _data, ...run } = result;
  return { decision, run, promptVersion: TRIAGE_PROMPT_VERSION };
}

/** No AI: keyword category + rules floor. Always flagged for human review. */
export function fallbackTriage(input: TriageInput, knowledge: WorkspaceKnowledge): TriageDecision {
  const text = ticketText(input);
  const guess = classifyByKeywords(text, knowledge);
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
