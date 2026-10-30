import type { CheckResult } from '@bookleaf/shared';
import { checkReply, type DraftClaim } from '../checker/index.js';
import {
  DRAFT_PROMPT_VERSION,
  DraftOutputSchema,
  draftSystem,
  draftContext,
  draftUserMessage,
} from '../prompts/draft.v1.js';
import type { LlmProvider, StructuredResult } from '../providers/types.js';
import { templateBody } from './templates.js';
import { firstName, type DraftInput } from './types.js';

export interface DraftResult {
  source: 'AI' | 'TEMPLATE';
  body: string;
  claims: DraftClaim[];
  check: CheckResult;
  promptVersion: string | null;
}

export interface AiDraftRun {
  draft: DraftResult;
  run: Omit<StructuredResult<unknown>, 'data'>;
}

const check = (input: DraftInput, body: string, claims: DraftClaim[]) =>
  checkReply({ body, facts: input.facts, claims, ignorePhrases: input.ignorePhrases });

/** Calls the model. Throws AiError subclasses; the job worker decides retry vs template fallback. */
export async function runAiDraft(
  provider: LlmProvider,
  model: string,
  input: DraftInput,
): Promise<AiDraftRun> {
  const promptInput = {
    category: input.category,
    knowledge: input.knowledge,
    authorFirstName: firstName(input.authorName),
    bookTitle: input.book?.title ?? null,
    facts: input.facts,
    subject: input.subject,
    authorMessages: input.authorMessages,
    lastTeamReply: input.lastTeamReply,
  };
  const result = await provider.generateStructured({
    task: 'DRAFT',
    model,
    stableSystem: draftSystem(input.knowledge),
    dynamicSystem: draftContext(promptInput),
    user: draftUserMessage(promptInput),
    schema: DraftOutputSchema,
    maxTokens: 1200,
    effort: 'medium',
  });
  const body = result.data.body.trim();
  const claims = result.data.claims;
  const { data: _data, ...run } = result;
  return {
    draft: {
      source: 'AI',
      body,
      claims,
      check: check(input, body, claims),
      promptVersion: DRAFT_PROMPT_VERSION,
    },
    run,
  };
}

export function templateDraft(input: DraftInput): DraftResult {
  const body = templateBody(input);
  return {
    source: 'TEMPLATE',
    body,
    claims: [],
    check: check(input, body, []),
    promptVersion: null,
  };
}
