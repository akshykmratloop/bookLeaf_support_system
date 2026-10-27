export type LiveState = 'connecting' | 'live' | 'polling';

const EVENTS_URL = '/api/v1/events';
const MAX_FAILURES = 3;
const POLL_MS = 15_000;
const SSE_RETRY_MS = 60_000;

/** The ticket id in a `ticket` event, or null if the event is not shaped as expected. */
function ticketIdOf(data: string): string | null {
  const event: unknown = JSON.parse(data);
  if (typeof event !== 'object' || event === null || !('ticketId' in event)) return null;
  return typeof event.ticketId === 'string' ? event.ticketId : null;
}

/** What the connection tells the app. */
export interface LiveHandlers {
  onState: (state: LiveState) => void;
  /** Refetch everything (after a reconnect, or on each poll). */
  refreshAll: () => void;
  /** Refetch one ticket's data. */
  refreshTicket: (ticketId: string) => void;
  onSessionExpired: () => void;
}

/**
 * Server-sent events with a polling fallback. After repeated failures it polls and keeps
 * retrying SSE in the background.
 */
export class LiveConnection {
  private source: EventSource | null = null;
  private failures = 0;
  private poll: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly on: LiveHandlers) {}

  connect = (): void => {
    this.source?.close();
    const source = new EventSource(EVENTS_URL);
    this.source = source;
    source.onopen = () => this.opened();
    source.onerror = () => this.failed();
    source.addEventListener('ticket', (ev) => {
      const ticketId = ticketIdOf((ev as MessageEvent<string>).data);
      if (ticketId) this.on.refreshTicket(ticketId);
    });
    source.addEventListener('session-expired', () => {
      source.close();
      this.on.onSessionExpired();
    });
  };

  close(): void {
    this.source?.close();
    this.stopPolling();
    if (this.retry) clearTimeout(this.retry);
  }

  private opened(): void {
    this.failures = 0;
    this.stopPolling();
    this.on.onState('live');
    this.on.refreshAll();
  }

  private failed(): void {
    this.failures += 1;
    if (this.failures < MAX_FAILURES) return;
    this.source?.close();
    this.startPolling();
  }

  private startPolling(): void {
    this.on.onState('polling');
    this.poll ??= setInterval(this.on.refreshAll, POLL_MS);
    this.retry = setTimeout(this.connect, SSE_RETRY_MS);
  }

  private stopPolling(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }
}
