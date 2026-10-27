import type { CheckResult, TicketProposal } from '@bookleaf/shared';
import { checkReply } from '../checker/index.js';
import { AiError } from '../providers/errors.js';
import type { LlmProvider, StructuredResult } from '../providers/types.js';
import {
  CHAT_SYSTEM,
  ChatOutputSchema,
  chatContext,
  chatUserMessage,
  type ChatOutput,
  type ChatPromptInput,
} from './prompt.v1.js';
import { toProposal } from './proposal.js';

export type ChatRunMeta = Omit<StructuredResult<unknown>, 'data'>;

export interface ChatAnswer {
  source: 'AI' | 'SAFE_FALLBACK';
  body: string;
  factIds: string[];
  check: CheckResult;
  proposal: TicketProposal | null;
  /** One entry per model call (1 or 2), for cost and latency logging. */
  runs: ChatRunMeta[];
}

export const SAFE_FALLBACK_TEXT =
  "I couldn't confirm that from your BookLeaf records or BookLeaf's guidelines, so I'd rather not guess. I can raise a ticket so the support team checks it and replies to you.";

/**
 * The model's reasoning counts toward this limit, not just the answer. A payout question with
 * a few claims measured ~1,400 output tokens; 700 cut it off and showed "unavailable". Only
 * tokens actually used are billed, so the headroom costs nothing on short answers.
 */
const MAX_TOKENS = 4000;

/** The author is waiting, so a temporary provider error gets one quick retry, not a backoff. */
const RETRY_DELAY_MS = 400;

async function callOnce(provider: LlmProvider, model: string, input: ChatPromptInput) {
  return provider.generateStructured({
    task: 'CHAT',
    model,
    stableSystem: CHAT_SYSTEM,
    dynamicSystem: chatContext(input),
    user: chatUserMessage(input),
    schema: ChatOutputSchema,
    maxTokens: MAX_TOKENS,
    effort: 'low',
  });
}

async function generate(provider: LlmProvider, model: string, input: ChatPromptInput) {
  let result: StructuredResult<ChatOutput>;
  try {
    result = await callOnce(provider, model, input);
  } catch (err) {
    if (!(err instanceof AiError) || !err.retryable) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    result = await callOnce(provider, model, input);
  }
  const { data, ...run } = result;
  return { data, run };
}

function checkOutput(input: ChatPromptInput, data: ChatOutput, ignorePhrases: string[]) {
  const body = data.answer.trim();
  return {
    body,
    check: checkReply({ body, facts: input.facts, claims: data.claims, ignorePhrases }),
  };
}

/**
 * One grounded answer: model call → independent fact check → at most one regeneration with the
 * checker's notes → safe fallback. Provider errors (AiError) propagate; the caller degrades.
 */
export async function answerChat(
  provider: LlmProvider,
  model: string,
  input: ChatPromptInput & { ignorePhrases: string[] },
): Promise<ChatAnswer> {
  const runs: ChatRunMeta[] = [];
  const first = await generate(provider, model, input);
  runs.push(first.run);
  let data = first.data;
  let { body, check } = checkOutput(input, data, input.ignorePhrases);
  if (!check.passed) {
    const notes = check.issues.filter((i) => i.severity === 'BLOCK').map((i) => i.message);
    const second = await generate(provider, model, { ...input, checkerNotes: notes });
    runs.push(second.run);
    data = second.data;
    ({ body, check } = checkOutput(input, data, input.ignorePhrases));
  }
  const proposal = toProposal(data.ticketSuggestion, input.books, input.message);
  if (!check.passed) {
    return {
      source: 'SAFE_FALLBACK',
      body: SAFE_FALLBACK_TEXT,
      factIds: [],
      check,
      proposal,
      runs,
    };
  }
  const factIds = [...new Set(data.claims.flatMap((c) => c.factIds))];
  return { source: 'AI', body, factIds, check, proposal, runs };
}
