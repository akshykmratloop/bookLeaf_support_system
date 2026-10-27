import type { VoiceEndReason } from '@bookleaf/shared';
import type { CallState } from './types.js';

export const TIME_WARNING = 'Just so you know, we have about thirty seconds left on this call.';

/**
 * Ends the call once (idempotent): stops timers, closes the provider, saves the outcome, and only
 * then tells the browser, so its after-call view finds the saved transcript and suggestion.
 */
export async function endCall(st: CallState, reason: VoiceEndReason): Promise<void> {
  if (st.ended) return;
  st.ended = true;
  st.timers.forEach((t) => clearTimeout(t));
  st.session?.close();
  const { transcript, proposal, usage, startedAt } = st;
  try {
    await st.deps.onEnd({
      reason,
      transcript,
      proposal,
      ...usage,
      startedAt,
      endedAt: st.deps.now(),
    });
  } catch (err) {
    st.deps.warn('failed to save the voice call outcome', err);
  }
  st.deps.caller.send({ type: 'ended', reason });
  st.deps.caller.close();
}

export const endSoon = (st: CallState, reason: VoiceEndReason) => void endCall(st, reason);

export const markActivity = (st: CallState) => {
  st.lastActivityAt = performance.now();
};

/** One check at a time; a failed read keeps the call going until the next check. */
async function recheckSwitch(st: CallState): Promise<void> {
  if (st.checkingSwitch || st.ended) return;
  st.checkingSwitch = true;
  try {
    if (!(await st.deps.isStillAllowed())) await endCall(st, 'DISABLED_BY_ADMIN');
  } catch (err) {
    st.deps.warn('could not re-check the voice switch', err);
  } finally {
    st.checkingSwitch = false;
  }
}

/** Seconds left before the hard cap, counted from when the timers were armed. */
export function secondsLeft(st: CallState): number {
  const elapsed = (performance.now() - st.armedAt) / 1000;
  return Math.max(0, Math.ceil(st.deps.limits.maxSeconds - elapsed));
}

/** Hard time cap with a spoken warning, idle hang-up, and the admin switch re-check. */
export function armLimits(st: CallState): void {
  const { limits, caller } = st.deps;
  st.armedAt = performance.now();
  st.lastActivityAt = st.armedAt;
  st.timers.push(
    setTimeout(
      () => {
        st.session?.say(TIME_WARNING);
        caller.send({ type: 'time_warning', secondsLeft: limits.warnBeforeEndSeconds });
      },
      (limits.maxSeconds - limits.warnBeforeEndSeconds) * 1000,
    ),
    setTimeout(() => endSoon(st, 'TIME_LIMIT'), limits.maxSeconds * 1000),
    setInterval(() => {
      if (performance.now() - st.lastActivityAt > limits.idleSeconds * 1000) endSoon(st, 'IDLE');
    }, 1000),
    setInterval(() => void recheckSwitch(st), limits.recheckSeconds * 1000),
  );
}
