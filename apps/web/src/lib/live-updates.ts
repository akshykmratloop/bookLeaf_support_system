import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { LiveConnection, type LiveState } from './liveConnection';
import { keys } from './queries';
import { onSessionExpired as onApiSessionExpired } from './sessionExpiry';

export type { LiveState } from './liveConnection';

/**
 * Keeps ticket data fresh, and reports an ended session (from the stream, or a 401 on any API
 * call) to `onSessionExpired`. SSE events are hints: on each one (and on every reconnect) the
 * matching queries are refetched through the REST API.
 */
export function useLiveUpdates(onSessionExpired: () => void): LiveState {
  const qc = useQueryClient();
  const [state, setState] = useState<LiveState>('connecting');

  useEffect(() => {
    const connection = new LiveConnection({
      onState: setState,
      onSessionExpired,
      refreshAll: () => {
        void qc.invalidateQueries({ queryKey: ['tickets'] });
        void qc.invalidateQueries({ queryKey: ['ticket'] });
        void qc.invalidateQueries({ queryKey: ['draft'] });
      },
      refreshTicket: (ticketId) => {
        void qc.invalidateQueries({ queryKey: ['tickets'] });
        void qc.invalidateQueries({ queryKey: keys.ticket(ticketId) });
        void qc.invalidateQueries({ queryKey: keys.draft(ticketId) });
      },
    });
    connection.connect();
    // Any API call answered 401 ends the session the same way as the stream's own event.
    const stopListening = onApiSessionExpired(onSessionExpired);
    return () => {
      connection.close();
      stopListening();
    };
  }, [qc, onSessionExpired]);

  return state;
}
