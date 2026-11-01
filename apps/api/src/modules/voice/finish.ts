import type { Fact } from '@bookleaf/shared';
import { checkReply } from '../../ai/checker/index.js';
import { recordRun } from '../../ai/jobs/runs.js';
import type { Db } from '../../platform/db.js';
import type { CallOutcome } from '../../voice/call/controller.js';
import { VOICE_PROMPT_VERSION } from '../../voice/call/instructions.js';
import { voiceUsageTotals } from '../../voice/providers/usage.js';
import { saveIntoChat } from './chat-link.js';
import { wordsToDigits } from '../../ai/checker/number-words.js';

/**
 * Checks every figure the assistant spoke against the facts snapshot it was given. Speech
 * cannot be blocked like a written reply, so this flags problems for admins after the call.
 */
export function checkSpokenFigures(outcome: CallOutcome, facts: readonly Fact[], ignore: string[]) {
  // The assistant says amounts in words; the checker reads digits.
  const spoken = wordsToDigits(
    outcome.transcript
      .filter((l) => l.role === 'ASSISTANT')
      .map((l) => l.text)
      .join('\n'),
  );
  if (!spoken.trim()) return { passed: true, issues: [] };
  const result = checkReply({ body: spoken, facts, ignorePhrases: ignore });
  const issues = result.issues
    .filter((i) => i.severity === 'BLOCK')
    .map((i) => ({ code: i.code, message: i.message }));
  return { passed: issues.length === 0, issues };
}

export interface FinishInput {
  callId: string;
  providerId: string;
  model: string;
  outcome: CallOutcome;
  facts: readonly Fact[];
  ignorePhrases: string[];
  /** The chat message limit; a call's saved lines never push a chat past it. */
  maxTurns: number;
  /** What the call cost, priced by its speech provider; null when the model has no price. */
  costMicros: number | null;
}

/**
 * One transaction: a call started from a chat never ends without its lines in that chat.
 * Returns the call's workspace, for the cost log.
 */
async function saveEnded(
  db: Db,
  input: FinishInput,
  failed: boolean,
  seconds: number,
): Promise<string> {
  const { outcome } = input;
  const tokens = voiceUsageTotals(outcome.usage);
  return db.$transaction(async (tx) => {
    const saved = await tx.voiceSession.update({
      where: { id: input.callId },
      data: {
        status: failed ? 'FAILED' : 'ENDED',
        endedAt: outcome.endedAt,
        endReason: outcome.reason,
        durationSeconds: seconds,
        transcript: outcome.transcript,
        spokenCheck: checkSpokenFigures(outcome, input.facts, input.ignorePhrases),
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
      },
      select: { id: true, chatSessionId: true, workspaceId: true },
    });
    await saveIntoChat(tx, saved, outcome.transcript, input.maxTurns);
    return saved.workspaceId;
  });
}

/** Saves the ended call (transcript, spoken-figure check, tokens, its chat) and logs its cost. */
export async function finishCall(db: Db, input: FinishInput): Promise<void> {
  const { outcome } = input;
  const failed = outcome.reason === 'PROVIDER_ERROR' && outcome.transcript.length === 0;
  const seconds = Math.max(
    0,
    Math.round((outcome.endedAt.getTime() - outcome.startedAt.getTime()) / 1000),
  );
  const workspaceId = await saveEnded(db, input, failed, seconds);
  const tokens = voiceUsageTotals(outcome.usage);
  await recordRun(db, {
    ticketId: null,
    workspaceId,
    task: 'VOICE',
    provider: input.providerId,
    model: input.model,
    promptVersion: VOICE_PROMPT_VERSION,
    // All input (cached included), its cached part, and all output; priced by the provider.
    usage: {
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cacheReadTokens: tokens.cachedInputTokens,
      cacheWriteTokens: 0,
    },
    costMicros: input.costMicros,
    latencyMs: seconds * 1000,
    errorCode: failed ? 'VOICE_UNAVAILABLE' : null,
  });
}
