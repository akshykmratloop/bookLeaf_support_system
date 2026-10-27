import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { conversationKeys } from '../conversations';
import { VoiceCallSession } from './session';

/** React view of one voice call. The call is hung up if the page unmounts. */
export function useVoiceCall() {
  const qc = useQueryClient();
  const [session] = useState(() => new VoiceCallSession());
  const view = useSyncExternalStore(session.subscribe, session.snapshot);
  useEffect(() => {
    return () => session.dispose();
  }, [session]);
  const ended = view.phase === 'ended';
  // A finished call is a new History entry.
  useEffect(() => {
    if (ended) void qc.invalidateQueries({ queryKey: conversationKeys.list });
  }, [ended, qc]);
  return {
    view,
    start: (opts: { resume?: boolean } = {}) => void session.start(opts),
    hangup: () => session.hangup(),
    toggleMute: () => session.toggleMute(),
    reset: () => session.reset(),
  };
}

export type VoiceCallControls = ReturnType<typeof useVoiceCall>;
