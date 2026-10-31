export type LiveState = 'connecting' | 'live' | 'polling';

const EVENTS_URL = '/api/v1/events';
const MAX_FAILURES = 3;
const POLL_MS = 15_000;
/** Reconnect waits grow from this, doubling each time, up to the cap. */
const RECONNECT_BASE_MS = 2_000;
export const RECONNECT_MAX_MS = 60_000;

/** The ticket id in a `ticket` event, or null if the event is not shaped as expected. */
export function ticketIdOf(data: string): string | null {
  let event: unknown;
  try {
    event = JSON.parse(data);
  } catch {
    return null; // a broken hint is ignored: the next poll or event refetches anyway
  }
  if (typeof event !== 'object' || event === null || !('ticketId' in event)) return null;
  return typeof event.ticketId === 'string' ? event.ticketId : null;
}

/** How long to wait before the n-th reconnect (1, 2, …): 2 s, 4 s, 8 s … up to 60 s. */
export const reconnectDelay = (attempt: number): number =>
  Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.max(0, attempt - 1));

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
 * Server-sent events with a polling fallback. The browser retries a dropped stream by itself;
 * after repeated failures, or when it gives up (the stream is CLOSED, e.g. a 502 from a proxy),
 * this polls at once and reconnects in the background with a growing wait.
 */
export class LiveConnection {
  private source: EventSource | null = null;
  private failures = 0;
  private reconnects = 0;
  private poll: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly on: LiveHandlers) {}

  connect = (): void => {
    this.retry = null;
    this.source?.close();
    const source = new EventSource(EVENTS_URL);
    this.source = source;
    source.onopen = () => this.opened();
    source.onerror = () => this.failed(source.readyState === EventSource.CLOSED);
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
    this.retry = null;
  }

  private opened(): void {
    this.failures = 0;
    this.reconnects = 0;
    this.stopPolling();
    this.on.onState('live');
    this.on.refreshAll();
  }

  /** `closed`: the browser will not retry by itself, so this does, at once. */
  private failed(closed: boolean): void {
    this.failures += 1;
    if (!closed && this.failures < MAX_FAILURES) return;
    this.source?.close();
    this.startPolling();
    this.scheduleReconnect();
  }

  private startPolling(): void {
    this.on.onState('polling');
    this.poll ??= setInterval(this.on.refreshAll, POLL_MS);
  }

  private scheduleReconnect(): void {
    if (this.retry) return;
    this.reconnects += 1;
    this.retry = setTimeout(this.connect, reconnectDelay(this.reconnects));
  }

  private stopPolling(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }
}
