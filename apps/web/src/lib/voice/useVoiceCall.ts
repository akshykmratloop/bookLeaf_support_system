import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { assistantKeys } from '../assistant';
import { conversationKeys } from '../conversations';
import { keys } from '../queries';
import { VoiceCallSession, type StartCallOptions } from './session';

/** How long the server may still be saving a call whose line dropped first. */
const SAVE_SETTLE_MS = 2000;

/** React view of one voice call. The call is hung up if the page unmounts. */
export function useVoiceCall() {
  const qc = useQueryClient();
  const [session] = useState(() => new VoiceCallSession());
  const view = useSyncExternalStore(session.subscribe, session.snapshot);
  useEffect(() => {
    return () => session.dispose();
  }, [session]);
  const ended = view.phase === 'ended';
  const sentTicket = view.draft?.status === 'SUBMITTED';
  // A finished call is a new History entry, and a call inside a chat is now saved into it. If
  // the line dropped before the server finished saving, a second refresh picks the lines up.
  useEffect(() => {
    if (!ended) return;
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: conversationKeys.list });
      void qc.invalidateQueries({ queryKey: assistantKeys.currentChat });
    };
    refresh();
    if (sentTicket) void qc.invalidateQueries({ queryKey: keys.tickets() });
    const again = setTimeout(refresh, SAVE_SETTLE_MS);
    return () => clearTimeout(again);
  }, [ended, sentTicket, qc]);
  return {
    view,
    start: (opts: StartCallOptions = {}) => void session.start(opts),
    hangup: () => session.hangup(),
    toggleMute: () => session.toggleMute(),
    reset: () => session.reset(),
  };
}

export type VoiceCallControls = ReturnType<typeof useVoiceCall>;
