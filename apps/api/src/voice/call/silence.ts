import type { VoiceEndReason } from '@bookleaf/shared';
import type { CallState, SilenceLines } from './types.js';

/**
 * The default (English) silence lines. They are scripted, not generated: nobody is answering, so
 * there is nothing for the model to think about, and the wording should never surprise anyone.
 */
export const SILENCE_LINES: SilenceLines = {
  stillThere: "Sorry, I can't hear you. Are you still there?",
  stillCantHear: "I still can't hear you. If you can hear me, please say something.",
  onMute: "It looks like you're on mute. Please unmute so I can hear you.",
  silenceGoodbye:
    "I can't hear anything, so I'll end this call now to save your time. You can call again any time. Goodbye!",
  muteGoodbye:
    "You seem to be on mute, so I'll end this call now. Unmute and call again any time. Goodbye!",
};

/** Nudges before the call is ended. */
const NUDGES = 2;

type EndCall = (st: CallState, reason: VoiceEndReason) => void;

const linesOf = (st: CallState): SilenceLines => st.deps.lines ?? SILENCE_LINES;

function nudgeLine(st: CallState): string {
  const lines = linesOf(st);
  if (st.callerMuted) return lines.onMute;
  return st.silenceNudges === 1 ? lines.stillThere : lines.stillCantHear;
}

/**
 * Runs every second. After each `silenceNudgeSeconds` of silence the assistant asks whether the
 * author is there (or says they are on mute), twice; the third time it says why it is hanging up
 * and the call ends once that line has played, so a silent call stops costing money. The clock is
 * `lastActivityAt`: assistant audio resets it too, so it only runs once the assistant is quiet.
 */
export function checkSilence(st: CallState, endCall: EndCall): void {
  if (st.ended || st.endRequested) return;
  const { silenceNudgeSeconds, goodbyeSeconds } = st.deps.limits;
  if (performance.now() - st.lastActivityAt <= silenceNudgeSeconds * 1000) return;
  // The next step is one full window away, even if the line below produces no audio.
  st.lastActivityAt = performance.now();
  if (st.silenceNudges < NUDGES) {
    st.silenceNudges += 1;
    st.session?.say(nudgeLine(st));
    return;
  }
  st.endRequested = true;
  st.goodbyeStarted = false;
  st.endReason = 'IDLE';
  st.session?.say(st.callerMuted ? linesOf(st).muteGoodbye : linesOf(st).silenceGoodbye);
  st.timers.push(setTimeout(() => endCall(st, 'IDLE'), goodbyeSeconds * 1000));
}

/** The author spoke, or unmuted: the silence ladder starts over. */
export function authorIsBack(st: CallState): void {
  st.silenceNudges = 0;
  st.lastActivityAt = performance.now();
}
