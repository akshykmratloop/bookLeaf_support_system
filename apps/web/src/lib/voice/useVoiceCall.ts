import { useEffect, useState, useSyncExternalStore } from 'react';
import { VoiceCallSession } from './session';

/** React view of one voice call. The call is hung up if the page unmounts. */
export function useVoiceCall() {
  const [session] = useState(() => new VoiceCallSession());
  const view = useSyncExternalStore(session.subscribe, session.snapshot);
  useEffect(() => {
    return () => session.dispose();
  }, [session]);
  return {
    view,
    start: (opts: { resume?: boolean } = {}) => void session.start(opts),
    hangup: () => session.hangup(),
    toggleMute: () => session.toggleMute(),
  };
}

export type VoiceCallControls = ReturnType<typeof useVoiceCall>;
