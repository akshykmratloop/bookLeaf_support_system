import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LiveConnection,
  reconnectDelay,
  RECONNECT_MAX_MS,
  ticketIdOf,
  type LiveHandlers,
} from './liveConnection';

/** Stands in for the browser's EventSource so the test can play the server and the network. */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static all: FakeEventSource[] = [];
  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, ((ev: { data: string }) => void)[]>();
  constructor(readonly url: string) {
    FakeEventSource.all.push(this);
  }
  addEventListener(type: string, fn: (ev: { data: string }) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
  open() {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }
  /** A dropped stream the browser will retry (readyState stays CONNECTING). */
  drop() {
    this.readyState = FakeEventSource.CONNECTING;
    this.onerror?.();
  }
  /** The browser gave up: a non-SSE answer such as a proxy's 502 page. */
  giveUp() {
    this.readyState = FakeEventSource.CLOSED;
    this.onerror?.();
  }
  emit(type: string, data: string) {
    for (const fn of this.listeners.get(type) ?? []) fn({ data });
  }
}

const latest = () => FakeEventSource.all[FakeEventSource.all.length - 1]!;

function handlers() {
  return {
    onState: vi.fn(),
    refreshAll: vi.fn(),
    refreshTicket: vi.fn(),
    onSessionExpired: vi.fn(),
  } satisfies LiveHandlers;
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.all = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ticketIdOf', () => {
  it('reads the ticket id, and ignores anything malformed instead of throwing', () => {
    expect(ticketIdOf('{"type":"ticket.replied","ticketId":"t-1"}')).toBe('t-1');
    expect(ticketIdOf('not json')).toBeNull();
    expect(ticketIdOf('{"ticketId":42}')).toBeNull();
    expect(ticketIdOf('null')).toBeNull();
  });
});

describe('reconnectDelay', () => {
  it('doubles from 2 s and stops at 60 s', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(reconnectDelay)).toEqual([
      2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000,
    ]);
    expect(reconnectDelay(100)).toBe(RECONNECT_MAX_MS);
  });
});

describe('LiveConnection', () => {
  it('goes live and refetches on open; a ticket event refetches that ticket', () => {
    const on = handlers();
    new LiveConnection(on).connect();
    latest().open();
    expect(on.onState).toHaveBeenLastCalledWith('live');
    expect(on.refreshAll).toHaveBeenCalledOnce();
    latest().emit('ticket', '{"type":"ticket.replied","ticketId":"t-9"}');
    latest().emit('ticket', '{broken');
    expect(on.refreshTicket).toHaveBeenCalledExactlyOnceWith('t-9');
  });

  it('lets the browser retry a few drops before falling back to polling', () => {
    const on = handlers();
    new LiveConnection(on).connect();
    latest().drop();
    latest().drop();
    expect(on.onState).not.toHaveBeenCalledWith('polling');
    latest().drop();
    expect(on.onState).toHaveBeenLastCalledWith('polling');
  });

  it('treats a CLOSED stream as final: polls at once and reconnects with a growing wait', () => {
    const on = handlers();
    const connection = new LiveConnection(on);
    connection.connect();
    latest().giveUp();
    expect(on.onState).toHaveBeenLastCalledWith('polling');

    vi.advanceTimersByTime(1_999);
    expect(FakeEventSource.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.all).toHaveLength(2);
    latest().giveUp();
    vi.advanceTimersByTime(3_999);
    expect(FakeEventSource.all).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.all).toHaveLength(3);
    latest().giveUp();
    vi.advanceTimersByTime(9_000); // 15 s since the first failure: one poll so far
    expect(on.refreshAll).toHaveBeenCalledOnce();

    latest().open();
    expect(on.onState).toHaveBeenLastCalledWith('live');
    const polls = on.refreshAll.mock.calls.length;
    vi.advanceTimersByTime(60_000);
    expect(on.refreshAll.mock.calls.length).toBe(polls);
    connection.close();
  });

  it('stops everything on close', () => {
    const on = handlers();
    const connection = new LiveConnection(on);
    connection.connect();
    latest().giveUp();
    connection.close();
    vi.advanceTimersByTime(120_000);
    expect(FakeEventSource.all).toHaveLength(1);
    expect(on.refreshAll).not.toHaveBeenCalled();
  });

  it('reports an expired session and stops listening', () => {
    const on = handlers();
    new LiveConnection(on).connect();
    latest().open();
    latest().emit('session-expired', '{}');
    expect(on.onSessionExpired).toHaveBeenCalledOnce();
    expect(latest().readyState).toBe(FakeEventSource.CLOSED);
  });
});
