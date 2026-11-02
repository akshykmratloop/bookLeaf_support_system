import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceCallSession } from './session';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  openMicrophone: vi.fn(),
  flush: vi.fn(),
  enqueue: vi.fn(),
  remainingMs: vi.fn(() => 0),
}));

vi.mock('../api', () => ({
  api: mocks.api,
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'Request failed'),
}));
vi.mock('./player', () => ({
  PcmPlayer: class {
    enqueue = mocks.enqueue;
    flush = mocks.flush;
    remainingMs = mocks.remainingMs;
  },
}));
vi.mock('./microphone', () => ({
  MicrophoneError: class extends Error {
    constructor(readonly reason: 'denied' | 'unavailable') {
      super(reason);
    }
  },
  openMicrophone: mocks.openMicrophone,
}));

/** Stands in for the browser socket so the test can play the server's side of the call. */
class FakeSocket {
  static readonly OPEN = 1;
  static last: FakeSocket | null = null;
  readyState = FakeSocket.OPEN;
  binaryType = 'blob';
  sent: unknown[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(
    readonly url: string,
    readonly protocols: string[] = [],
  ) {
    FakeSocket.last = this;
  }
  send(data: unknown) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  server(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const mic = { ctx: {}, setMuted: vi.fn(), stop: vi.fn(), close: vi.fn() };
let micChunk: (pcm: ArrayBuffer) => void = () => undefined;

async function startedCall(): Promise<{ session: VoiceCallSession; ws: FakeSocket }> {
  const session = new VoiceCallSession();
  await session.start();
  if (!FakeSocket.last) throw new Error('socket was not opened');
  return { session, ws: FakeSocket.last };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.last = null;
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('window', { location: { protocol: 'http:', host: 'localhost:3100' } });
  mocks.api.mockResolvedValue({ id: 'call-1', socketPath: '/api/v1/voice/calls/call-1/stream' });
  mocks.openMicrophone.mockImplementation((onChunk: (pcm: ArrayBuffer) => void) => {
    micChunk = onChunk;
    return Promise.resolve(mic);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('VoiceCallSession', () => {
  it('connects to the call socket on the same host and goes live on ready', async () => {
    const { session, ws } = await startedCall();
    expect(ws.url).toBe('ws://localhost:3100/api/v1/voice/calls/call-1/stream');
    expect(ws.protocols).toEqual(['bookleaf.v1']);
    expect(session.snapshot().phase).toBe('connecting');
    ws.server({ type: 'ready', maxSeconds: 300 });
    expect(session.snapshot()).toMatchObject({ phase: 'live', secondsLeft: 300 });
  });

  it('opens the API on another site with the ticket as a subprotocol, never in the URL', async () => {
    mocks.api.mockResolvedValueOnce({
      id: 'call-1',
      socketPath: '/api/v1/voice/calls/call-1/stream',
      socketUrl: 'wss://api.example.com/api/v1/voice/calls/call-1/stream',
      socketTicket: 'aaa.bbb.ccc',
    });
    const { ws } = await startedCall();
    expect(ws.url).toBe('wss://api.example.com/api/v1/voice/calls/call-1/stream');
    expect(ws.protocols).toEqual(['bookleaf.v1', 'ticket.aaa.bbb.ccc']);
  });

  it('counts down from the server limit', async () => {
    const { session, ws } = await startedCall();
    ws.server({ type: 'ready', maxSeconds: 300 });
    vi.advanceTimersByTime(61_000);
    expect(session.snapshot().secondsLeft).toBe(239);
  });

  it('only sends microphone audio once the call is live', async () => {
    const { ws } = await startedCall();
    micChunk(new ArrayBuffer(8));
    expect(ws.sent).toHaveLength(0);
    ws.server({ type: 'ready', maxSeconds: 300 });
    micChunk(new ArrayBuffer(8));
    expect(ws.sent).toHaveLength(1);
  });

  it('stops assistant audio when the caller interrupts, and shows transcript lines', async () => {
    const { session, ws } = await startedCall();
    ws.server({ type: 'ready', maxSeconds: 300 });
    ws.server({ type: 'transcript', role: 'AUTHOR', text: 'When is my royalty paid?' });
    ws.server({ type: 'interrupt' });
    expect(mocks.flush).toHaveBeenCalled();
    expect(session.snapshot().lines).toEqual([
      { role: 'AUTHOR', text: 'When is my royalty paid?' },
    ]);
  });

  it('shows the latest ticket draft the server sends during the call', async () => {
    const { session, ws } = await startedCall();
    ws.server({ type: 'ready', maxSeconds: 300 });
    const draft = {
      id: '00000000-0000-4000-8000-000000000001',
      category: 'PRINTING_QUALITY',
      bookId: null,
      subject: 'Damaged copies',
      description: '',
      status: 'OPEN',
      version: 2,
      lastEditedBy: 'ASSISTANT',
      isComplete: false,
      ticket: null,
      updatedAt: '2026-10-27T10:00:00.000Z',
    };
    ws.server({ type: 'draft', draft });
    expect(session.snapshot().draft).toEqual(draft);
  });

  it('asks the server to continue the last call only when resuming', async () => {
    await new VoiceCallSession().start({ resume: true });
    expect(mocks.api).toHaveBeenLastCalledWith('/voice/calls', {
      method: 'POST',
      body: { resume: true },
    });
    await new VoiceCallSession().start();
    expect(mocks.api).toHaveBeenLastCalledWith('/voice/calls', {
      method: 'POST',
      body: { resume: false },
    });
  });

  it('joins the chat it was started from, so the call and the chat are one conversation', async () => {
    const chatSessionId = '44444444-4444-4444-8444-444444444444';
    await new VoiceCallSession().start({ chatSessionId });
    expect(mocks.api).toHaveBeenLastCalledWith('/voice/calls', {
      method: 'POST',
      body: { resume: false, chatSessionId },
    });
  });

  it('records why the server ended the call and releases the microphone', async () => {
    const { session, ws } = await startedCall();
    ws.server({ type: 'ready', maxSeconds: 300 });
    ws.server({ type: 'time_warning', secondsLeft: 30 });
    expect(session.snapshot().timeWarning).toBe(true);
    ws.server({ type: 'ended', reason: 'TIME_LIMIT' });
    expect(session.snapshot()).toMatchObject({ phase: 'ended', endReason: 'TIME_LIMIT' });
    expect(mic.close).toHaveBeenCalled();
  });

  it('sends hangup to the server instead of just dropping the socket', async () => {
    const { session, ws } = await startedCall();
    ws.server({ type: 'ready', maxSeconds: 300 });
    session.hangup();
    expect(ws.sent).toEqual([JSON.stringify({ type: 'hangup' })]);
    expect(session.snapshot().phase).toBe('ending');
  });

  it('tells the server when the caller mutes and unmutes, so it can say they are on mute', async () => {
    const { session, ws } = await startedCall();
    ws.server({ type: 'ready', maxSeconds: 300 });
    session.toggleMute();
    session.toggleMute();
    expect(mic.setMuted.mock.calls).toEqual([[true], [false]]);
    expect(ws.sent).toEqual([
      JSON.stringify({ type: 'mute', muted: true }),
      JSON.stringify({ type: 'mute', muted: false }),
    ]);
  });

  it('explains a refused connection using the server close code', async () => {
    const { session, ws } = await startedCall();
    ws.onclose?.({ code: 4503 });
    expect(session.snapshot().phase).toBe('failed');
    expect(session.snapshot().error).toMatch(/unavailable/i);
  });

  it('marks a dropped live call as disconnected', async () => {
    const { session, ws } = await startedCall();
    ws.server({ type: 'ready', maxSeconds: 300 });
    ws.onclose?.({ code: 1006 });
    expect(session.snapshot()).toMatchObject({ phase: 'ended', endReason: 'DISCONNECTED' });
  });

  it('fails without opening a socket when the server refuses to start a call', async () => {
    mocks.api.mockRejectedValue(new Error('You have used all your calls for this hour.'));
    const session = new VoiceCallSession();
    await session.start();
    expect(FakeSocket.last).toBeNull();
    expect(session.snapshot()).toMatchObject({
      phase: 'failed',
      error: 'You have used all your calls for this hour.',
    });
    expect(mic.close).toHaveBeenCalled();
  });

  it('never creates a call when the microphone is unavailable', async () => {
    mocks.openMicrophone.mockRejectedValue(new Error('no device'));
    const session = new VoiceCallSession();
    await session.start();
    expect(mocks.api).not.toHaveBeenCalled();
    expect(session.snapshot().phase).toBe('failed');
  });

  it('gives up a start that is still waiting when the page is left, and releases the mic', async () => {
    let finishPost: (v: unknown) => void = () => undefined;
    mocks.api.mockReturnValue(new Promise((resolve) => (finishPost = resolve)));
    const session = new VoiceCallSession();
    const starting = session.start();
    await vi.waitFor(() => expect(mocks.api).toHaveBeenCalled());
    session.dispose();
    finishPost({ id: 'call-1', socketPath: '/api/v1/voice/calls/call-1/stream' });
    await starting;
    expect(FakeSocket.last).toBeNull();
    expect(mic.close).toHaveBeenCalled();
  });

  it('lets the goodbye finish playing before releasing the audio device', async () => {
    const { ws } = await startedCall();
    ws.server({ type: 'ready', maxSeconds: 300 });
    mocks.remainingMs.mockReturnValue(2000);
    ws.server({ type: 'ended', reason: 'ASSISTANT_ENDED' });
    expect(mic.stop).toHaveBeenCalled();
    expect(mic.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(mic.close).toHaveBeenCalled();
  });

  it('does not let an old hang-up timer close the next call', async () => {
    const { session, ws: first } = await startedCall();
    first.server({ type: 'ready', maxSeconds: 300 });
    session.hangup();
    first.server({ type: 'ended', reason: 'USER_HANGUP' });
    await session.start();
    const second = FakeSocket.last;
    vi.advanceTimersByTime(5000);
    expect(second).not.toBe(first);
    expect(second?.readyState).toBe(FakeSocket.OPEN);
  });

  it('ignores a late "ready" after the caller already hung up', async () => {
    const { session, ws } = await startedCall();
    session.hangup();
    ws.server({ type: 'ready', maxSeconds: 300 });
    expect(session.snapshot().phase).toBe('ending');
  });
});
