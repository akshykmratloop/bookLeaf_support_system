import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { keys } from './queries';

export type LiveState = 'connecting' | 'live' | 'polling';

const MAX_FAILURES = 3;
const POLL_MS = 15_000;
const SSE_RETRY_MS = 60_000;

/**
 * Keeps ticket data fresh. SSE events are hints: on each one (and on every reconnect) the
 * matching queries are refetched through the REST API. After repeated SSE failures it falls
 * back to polling and keeps trying SSE in the background.
 */
export function useLiveUpdates(onSessionExpired: () => void): LiveState {
  const qc = useQueryClient();
  const [state, setState] = useState<LiveState>('connecting');

  useEffect(() => {
    let source: EventSource | null = null;
    let failures = 0;
    let poll: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const refreshAll = () => {
      void qc.invalidateQueries({ queryKey: ['tickets'] });
      void qc.invalidateQueries({ queryKey: ['ticket'] });
      void qc.invalidateQueries({ queryKey: ['draft'] });
    };
    const startPolling = () => {
      setState('polling');
      poll ??= setInterval(refreshAll, POLL_MS);
      retry = setTimeout(connect, SSE_RETRY_MS);
    };
    function connect() {
      source?.close();
      source = new EventSource('/api/v1/events');
      source.onopen = () => {
        failures = 0;
        if (poll) clearInterval(poll);
        poll = null;
        setState('live');
        refreshAll();
      };
      source.addEventListener('ticket', (ev) => {
        const { ticketId } = JSON.parse((ev as MessageEvent<string>).data) as { ticketId: string };
        void qc.invalidateQueries({ queryKey: ['tickets'] });
        void qc.invalidateQueries({ queryKey: keys.ticket(ticketId) });
        void qc.invalidateQueries({ queryKey: keys.draft(ticketId) });
      });
      source.addEventListener('session-expired', () => {
        source?.close();
        onSessionExpired();
      });
      source.onerror = () => {
        failures += 1;
        if (failures >= MAX_FAILURES) {
          source?.close();
          startPolling();
        }
      };
    }
    connect();
    return () => {
      source?.close();
      if (poll) clearInterval(poll);
      if (retry) clearTimeout(retry);
    };
  }, [qc, onSessionExpired]);

  return state;
}
