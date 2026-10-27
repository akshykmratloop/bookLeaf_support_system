import { endSoon } from './lifecycle.js';
import type { CallState } from './types.js';

/** Spoken once the last allowed question has been answered (the default, English wording). */
export const TURN_LIMIT_GOODBYE =
  "That's all we can cover in this conversation, as it has reached its message limit. You can start a new conversation any time. Take care, goodbye!";

/** Longest wait for the last answer and the goodbye before the call is ended anyway. */
export const TURN_LIMIT_GRACE_SECONDS = 25;

/**
 * Counts the author's spoken lines against the conversation's allowance. On the line that uses
 * the last turn, the limit is armed: the answer to it is still given, then the goodbye.
 */
export function countAuthorTurn(st: CallState): void {
  st.authorTurns += 1;
  const left = st.deps.limits.turnsLeft ?? null;
  if (left === null || st.turnLimitHit || st.authorTurns < left) return;
  st.turnLimitHit = true;
  st.timers.push(setTimeout(() => endSoon(st, 'TURN_LIMIT'), TURN_LIMIT_GRACE_SECONDS * 1000));
}

/**
 * After the answer to the last allowed question finishes, says the goodbye and ends the call
 * once it has been spoken. Returns true when it took over this reply_done.
 */
export function sayLimitGoodbye(st: CallState): boolean {
  if (!st.turnLimitHit || st.endRequested) return false;
  st.endRequested = true;
  st.goodbyeStarted = false;
  st.endReason = 'TURN_LIMIT';
  st.session?.say(st.deps.lines?.turnLimitGoodbye ?? TURN_LIMIT_GOODBYE);
  return true;
}
