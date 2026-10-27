import type {
  TicketProposal,
  TranscriptLine,
  VoiceEndReason,
  VoiceServerMessage,
} from '@bookleaf/shared';
import type {
  VoiceEvent,
  VoiceProvider,
  VoiceSession,
  VoiceSessionConfig,
} from '../providers/types.js';
import { END_CALL, SUGGEST_TICKET } from './instructions.js';
import { parseSuggestion } from './tools.js';

/** The browser side of the call (a WebSocket in production, a fake in tests). */
export interface CallerChannel {
  sendAudio(pcm16: Buffer): void;
  send(message: VoiceServerMessage): void;
  close(): void;
}

export interface CallOutcome {
  reason: VoiceEndReason;
  transcript: TranscriptLine[];
  proposal: TicketProposal | null;
  inputTokens: number;
  outputTokens: number;
  startedAt: Date;
  endedAt: Date;
}

export interface CallLimits {
  maxSeconds: number;
  warnBeforeEndSeconds: number;
  idleSeconds: number;
  /** How often the admin switch is re-checked during the call. */
  recheckSeconds: number;
  /** Longest wait for the goodbye after end_call before hanging up anyway. */
  goodbyeSeconds: number;
}

export interface CallDeps {
  provider: VoiceProvider;
  config: VoiceSessionConfig;
  books: readonly { id: string }[];
  limits: CallLimits;
  caller: CallerChannel;
  now: () => Date;
  isStillAllowed: () => Promise<boolean>;
  onEnd: (outcome: CallOutcome) => Promise<void>;
}

export interface CallHandle {
  onCallerAudio(pcm16: Buffer): void;
  onCallerHangup(): void;
  onCallerGone(): void;
}

export const TIME_WARNING = 'Just so you know, we have about thirty seconds left on this call.';

interface CallState {
  deps: CallDeps;
  startedAt: Date;
  transcript: TranscriptLine[];
  usage: { inputTokens: number; outputTokens: number };
  proposal: TicketProposal | null;
  session: VoiceSession | null;
  /** Monotonic ms of the last caller audio frame (elapsed time only). */
  lastAudioAt: number;
  hangUpAfterReply: boolean;
  ended: boolean;
  timers: ReturnType<typeof setTimeout>[];
}

const NOOP_HANDLE: CallHandle = {
  onCallerAudio: () => undefined,
  onCallerHangup: () => undefined,
  onCallerGone: () => undefined,
};

/** Ends the call once (idempotent): stops timers, closes both sides, persists the outcome. */
async function endCall(st: CallState, reason: VoiceEndReason): Promise<void> {
  if (st.ended) return;
  st.ended = true;
  st.timers.forEach((t) => clearTimeout(t));
  st.session?.close();
  st.deps.caller.send({ type: 'ended', reason });
  st.deps.caller.close();
  const { transcript, proposal, usage, startedAt } = st;
  await st.deps.onEnd({
    reason,
    transcript,
    proposal,
    ...usage,
    startedAt,
    endedAt: st.deps.now(),
  });
}

const endSoon = (st: CallState, reason: VoiceEndReason) => void endCall(st, reason);

function runTool(st: CallState, callId: string, name: string, argumentsJson: string): void {
  const { caller, books, limits } = st.deps;
  if (name === SUGGEST_TICKET) {
    const lastAuthorLine =
      [...st.transcript].reverse().find((l) => l.role === 'AUTHOR')?.text ?? '';
    st.proposal = parseSuggestion(argumentsJson, books, lastAuthorLine) ?? st.proposal;
    if (st.proposal) caller.send({ type: 'ticket_suggested' });
    st.session?.sendToolResult(callId, {
      status: 'prepared',
      note: 'The author can review and send it on screen after the call.',
    });
  } else if (name === END_CALL) {
    st.hangUpAfterReply = true;
    st.session?.sendToolResult(callId, { status: 'ending' });
    st.timers.push(setTimeout(() => endSoon(st, 'ASSISTANT_ENDED'), limits.goodbyeSeconds * 1000));
  } else {
    st.session?.sendToolResult(callId, { error: 'Unknown tool' });
  }
}

function onProviderEvent(st: CallState, e: VoiceEvent): void {
  if (st.ended) return;
  const { caller } = st.deps;
  if (e.type === 'audio') caller.sendAudio(e.pcm16);
  else if (e.type === 'transcript') {
    st.transcript.push({ role: e.role, text: e.text, at: st.deps.now().toISOString() });
    caller.send({ type: 'transcript', role: e.role, text: e.text });
  } else if (e.type === 'barge_in') caller.send({ type: 'interrupt' });
  else if (e.type === 'tool_call') runTool(st, e.callId, e.name, e.argumentsJson);
  else if (e.type === 'reply_done' && st.hangUpAfterReply) endSoon(st, 'ASSISTANT_ENDED');
  else if (e.type === 'usage') {
    st.usage.inputTokens += e.inputTokens;
    st.usage.outputTokens += e.outputTokens;
  } else if (e.type === 'error' || e.type === 'closed') endSoon(st, 'PROVIDER_ERROR');
}

/** Hard time cap with a spoken warning, idle hang-up, and the admin switch re-check. */
function armLimits(st: CallState): void {
  const { limits, caller } = st.deps;
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
      if (performance.now() - st.lastAudioAt > limits.idleSeconds * 1000) endSoon(st, 'IDLE');
    }, 1000),
    setInterval(() => {
      void st.deps
        .isStillAllowed()
        .then((ok) => (ok ? undefined : endCall(st, 'DISABLED_BY_ADMIN')));
    }, limits.recheckSeconds * 1000),
  );
}

/** Runs one call: connects the provider, relays audio, runs tools and enforces every limit. */
export async function startCall(deps: CallDeps): Promise<CallHandle> {
  const st: CallState = {
    deps,
    startedAt: deps.now(),
    transcript: [],
    usage: { inputTokens: 0, outputTokens: 0 },
    proposal: null,
    session: null,
    lastAudioAt: performance.now(),
    hangUpAfterReply: false,
    ended: false,
    timers: [],
  };
  try {
    st.session = await deps.provider.connect(deps.config, (e) => onProviderEvent(st, e));
  } catch {
    await endCall(st, 'PROVIDER_ERROR');
    return NOOP_HANDLE;
  }
  if (st.ended) return NOOP_HANDLE;
  deps.caller.send({ type: 'ready', maxSeconds: deps.limits.maxSeconds });
  st.session.greet();
  st.lastAudioAt = performance.now();
  armLimits(st);
  return {
    onCallerAudio: (pcm16) => {
      if (st.ended) return;
      st.lastAudioAt = performance.now();
      st.session?.sendAudio(pcm16);
    },
    onCallerHangup: () => endSoon(st, 'USER_HANGUP'),
    onCallerGone: () => endSoon(st, 'DISCONNECTED'),
  };
}
