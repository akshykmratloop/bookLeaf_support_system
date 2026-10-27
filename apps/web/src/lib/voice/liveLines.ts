import type { CallView } from './view';

/**
 * The call's lines to show in the chat thread: everything said on the current call until the
 * chat itself holds them (it saves them when the call ends), so nothing shows twice or vanishes.
 */
export function liveCallLines(
  view: CallView,
  saved: readonly { callId: string | null }[],
): CallView['lines'] {
  if (!view.callId || view.phase === 'failed' || view.phase === 'idle') return [];
  return saved.some((m) => m.callId === view.callId) ? [] : view.lines;
}
