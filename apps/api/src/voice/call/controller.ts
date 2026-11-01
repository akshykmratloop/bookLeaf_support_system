import type { VoiceEvent } from '../providers/types.js';
import { addVoiceUsage, NO_VOICE_USAGE } from '../providers/usage.js';
import { onDraftUpdate, runDraftTool } from './draft-sync.js';
import { armLimits, endCall, endSoon, markActivity, secondsLeft } from './lifecycle.js';
import { DRAFT_TOOLS, END_CALL } from './tool-defs.js';
import { countAuthorTurn, sayLimitGoodbye } from './turn-limit.js';
import type { CallDeps, CallHandle, CallState } from './types.js';

export { TIME_WARNING } from './lifecycle.js';
export type { CallDeps, CallHandle, CallLimits, CallOutcome, CallerChannel } from './types.js';

const NOOP_HANDLE: CallHandle = {
  onCallerAudio: () => undefined,
  onCallerHangup: () => undefined,
  onCallerGone: () => undefined,
};

function runTool(st: CallState, callId: string, name: string, argumentsJson: string): void {
  const { limits } = st.deps;
  if (DRAFT_TOOLS.has(name)) {
    runDraftTool(st, callId, name, argumentsJson);
  } else if (name === END_CALL) {
    // The reply that carried this tool call finishes first; wait for the goodbye that follows.
    st.endRequested = true;
    st.goodbyeStarted = false;
    st.session?.sendToolResult(callId, { status: 'ending' });
    st.timers.push(setTimeout(() => endSoon(st, 'ASSISTANT_ENDED'), limits.goodbyeSeconds * 1000));
  } else {
    st.session?.sendToolResult(callId, { error: 'Unknown tool' });
  }
}

type EventHandlers = {
  [K in VoiceEvent['type']]: (st: CallState, e: Extract<VoiceEvent, { type: K }>) => void;
};

/** What the call does with each provider event. */
const ON_EVENT: EventHandlers = {
  audio: (st, e) => {
    markActivity(st);
    if (st.endRequested) st.goodbyeStarted = true;
    st.deps.caller.sendAudio(e.pcm16);
  },
  transcript: (st, e) => {
    markActivity(st);
    st.transcript.push({ role: e.role, text: e.text, at: st.deps.now().toISOString() });
    st.deps.caller.send({ type: 'transcript', role: e.role, text: e.text });
    if (e.role !== 'AUTHOR' || !e.text.trim()) return;
    // Only words count as the author's answer to "Shall I send it?", never noise or silence.
    st.answeredSinceConfirm = true;
    countAuthorTurn(st);
  },
  barge_in: (st) => {
    markActivity(st);
    st.deps.caller.send({ type: 'interrupt' });
  },
  tool_call: (st, e) => runTool(st, e.callId, e.name, e.argumentsJson),
  reply_done: (st, e) => {
    markActivity(st);
    if (st.goodbyeStarted) endSoon(st, st.endReason);
    else if (e.final !== false) sayLimitGoodbye(st);
  },
  usage: (st, e) => {
    st.usage = addVoiceUsage(st.usage, e.usage);
  },
  error: (st) => endSoon(st, 'PROVIDER_ERROR'),
  closed: (st) => endSoon(st, 'PROVIDER_ERROR'),
};

function onProviderEvent(st: CallState, e: VoiceEvent): void {
  if (st.ended) return;
  const handle = ON_EVENT[e.type] as (st: CallState, e: VoiceEvent) => void;
  handle(st, e);
}

function newState(deps: CallDeps): CallState {
  return {
    deps,
    startedAt: deps.now(),
    armedAt: performance.now(),
    transcript: [],
    usage: NO_VOICE_USAGE,
    session: null,
    draftStatus: deps.draft.initial.status,
    confirmAsked: false,
    answeredSinceConfirm: false,
    unwatch: null,
    lastActivityAt: performance.now(),
    endRequested: false,
    goodbyeStarted: false,
    endReason: 'ASSISTANT_ENDED',
    authorTurns: 0,
    turnLimitHit: false,
    checkingSwitch: false,
    ended: false,
    timers: [],
  };
}

/**
 * Runs one call: connects the provider, relays audio, runs tools and enforces every limit. The
 * clock starts before the provider connects, so a slow connect cannot stretch the call.
 */
export async function startCall(deps: CallDeps): Promise<CallHandle> {
  const st = newState(deps);
  armLimits(st);
  try {
    st.session = await deps.provider.connect(deps.config, (e) => onProviderEvent(st, e));
  } catch (err) {
    deps.warn('voice provider did not connect', err);
    await endCall(st, 'PROVIDER_ERROR');
    return NOOP_HANDLE;
  }
  if (st.ended) {
    st.session.close();
    return NOOP_HANDLE;
  }
  deps.caller.send({ type: 'ready', maxSeconds: secondsLeft(st) });
  deps.caller.send({ type: 'draft', draft: deps.draft.initial });
  st.unwatch = deps.draft.watch((update) => {
    try {
      onDraftUpdate(st, update);
    } catch (err) {
      deps.warn('could not pass on a ticket draft change', err);
    }
  });
  st.session.greet();
  markActivity(st);
  return {
    onCallerAudio: (pcm16) => {
      // Once the last allowed question was asked, the call only finishes answering it.
      if (!st.ended && !st.turnLimitHit) st.session?.sendAudio(pcm16);
    },
    onCallerHangup: () => endSoon(st, 'USER_HANGUP'),
    onCallerGone: () => endSoon(st, 'DISCONNECTED'),
  };
}
