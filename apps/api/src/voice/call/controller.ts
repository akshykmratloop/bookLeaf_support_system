import type { VoiceEvent } from '../providers/types.js';
import { onDraftUpdate, runDraftTool } from './draft-sync.js';
import { armLimits, endCall, endSoon, markActivity, secondsLeft } from './lifecycle.js';
import { DRAFT_TOOLS, END_CALL } from './tool-defs.js';
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

function onProviderEvent(st: CallState, e: VoiceEvent): void {
  if (st.ended) return;
  const { caller } = st.deps;
  if (e.type === 'audio') {
    markActivity(st);
    if (st.endRequested) st.goodbyeStarted = true;
    caller.sendAudio(e.pcm16);
  } else if (e.type === 'transcript') {
    markActivity(st);
    if (e.role === 'AUTHOR') st.answeredSinceConfirm = true;
    st.transcript.push({ role: e.role, text: e.text, at: st.deps.now().toISOString() });
    caller.send({ type: 'transcript', role: e.role, text: e.text });
  } else if (e.type === 'barge_in') {
    markActivity(st);
    st.answeredSinceConfirm = true;
    caller.send({ type: 'interrupt' });
  } else if (e.type === 'tool_call') runTool(st, e.callId, e.name, e.argumentsJson);
  else if (e.type === 'reply_done') {
    markActivity(st);
    if (st.goodbyeStarted) endSoon(st, 'ASSISTANT_ENDED');
  } else if (e.type === 'usage') {
    st.usage.inputTokens += e.inputTokens;
    st.usage.outputTokens += e.outputTokens;
  } else if (e.type === 'error' || e.type === 'closed') endSoon(st, 'PROVIDER_ERROR');
}

function newState(deps: CallDeps): CallState {
  return {
    deps,
    startedAt: deps.now(),
    armedAt: performance.now(),
    transcript: [],
    usage: { inputTokens: 0, outputTokens: 0 },
    session: null,
    draftStatus: deps.draft.initial.status,
    confirmAsked: false,
    answeredSinceConfirm: false,
    unwatch: null,
    lastActivityAt: performance.now(),
    endRequested: false,
    goodbyeStarted: false,
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
      if (!st.ended) st.session?.sendAudio(pcm16);
    },
    onCallerHangup: () => endSoon(st, 'USER_HANGUP'),
    onCallerGone: () => endSoon(st, 'DISCONNECTED'),
  };
}
