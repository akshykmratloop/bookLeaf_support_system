import type { VoiceServerMessage } from '@bookleaf/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeVoiceProvider, type FakeVoiceProvider } from '../providers/fake/provider.js';
import { startCall, TIME_WARNING, type CallOutcome } from './controller.js';

const LIMITS = {
  maxSeconds: 300,
  warnBeforeEndSeconds: 30,
  idleSeconds: 45,
  recheckSeconds: 15,
  goodbyeSeconds: 8,
};
const BOOK = '11111111-1111-4111-8111-111111111111';

let provider: FakeVoiceProvider;
let sent: VoiceServerMessage[];
let audioOut: Buffer[];
let outcomes: CallOutcome[];
let allowed: boolean | 'throws';
let callerClosed: boolean;
let warnings: string[];
/** What happened, in order: lets tests check the outcome is saved before "ended" is sent. */
let order: string[];
let saveFails: boolean;

/** Speech detected by the provider: the only thing that counts as the caller being there. */
const speak = () => provider.emit({ type: 'barge_in' });

async function call() {
  return startCall({
    provider,
    config: { instructions: 'x', tools: [], language: 'en' },
    books: [{ id: BOOK }],
    limits: LIMITS,
    caller: {
      sendAudio: (b) => audioOut.push(b),
      send: (m) => {
        sent.push(m);
        order.push(`sent:${m.type}`);
      },
      close: () => {
        callerClosed = true;
      },
    },
    now: () => new Date(),
    isStillAllowed: async () => {
      if (allowed === 'throws') throw new Error('database unavailable');
      return allowed;
    },
    onEnd: async (o) => {
      if (saveFails) throw new Error('database unavailable');
      outcomes.push(o);
      order.push('saved');
    },
    warn: (message) => warnings.push(message),
  });
}

const endedWith = () => sent.find((m) => m.type === 'ended');

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'],
  });
  provider = fakeVoiceProvider();
  sent = [];
  audioOut = [];
  outcomes = [];
  allowed = true;
  callerClosed = false;
  warnings = [];
  order = [];
  saveFails = false;
});
afterEach(() => vi.useRealTimers());

describe('voice call controller', () => {
  it('connects, greets and relays audio both ways', async () => {
    const handle = await call();
    expect(sent[0]).toEqual({ type: 'ready', maxSeconds: 300 });
    expect(provider.greeted).toBe(1);
    handle.onCallerAudio(Buffer.from([1, 2]));
    provider.emit({ type: 'audio', pcm16: Buffer.from([3, 4]) });
    expect(provider.audioIn).toEqual([Buffer.from([1, 2])]);
    expect(audioOut).toEqual([Buffer.from([3, 4])]);
  });

  it('warns 30 seconds before the limit and hangs up at exactly 5 minutes', async () => {
    await call();
    const keepTalking = setInterval(speak, 1000);
    await vi.advanceTimersByTimeAsync(269_000);
    expect(provider.said).toEqual([]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(provider.said).toEqual([TIME_WARNING]);
    expect(sent).toContainEqual({ type: 'time_warning', secondsLeft: 30 });
    await vi.advanceTimersByTimeAsync(29_000);
    expect(endedWith()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1_000);
    clearInterval(keepTalking);
    expect(endedWith()).toEqual({ type: 'ended', reason: 'TIME_LIMIT' });
    expect(outcomes[0]?.reason).toBe('TIME_LIMIT');
    expect(provider.closed).toBe(true);
    expect(callerClosed).toBe(true);
  });

  it('hangs up after 45 seconds without conversation', async () => {
    await call();
    await vi.advanceTimersByTimeAsync(46_000);
    expect(endedWith()).toEqual({ type: 'ended', reason: 'IDLE' });
  });

  it('still hangs up when the browser streams only silence (muted or walked away)', async () => {
    const handle = await call();
    const silence = setInterval(() => handle.onCallerAudio(Buffer.alloc(1920)), 40);
    await vi.advanceTimersByTimeAsync(46_000);
    clearInterval(silence);
    expect(endedWith()).toEqual({ type: 'ended', reason: 'IDLE' });
  });

  it('saves the outcome before telling the browser the call ended', async () => {
    const handle = await call();
    handle.onCallerHangup();
    await vi.advanceTimersByTimeAsync(0);
    expect(order.slice(-2)).toEqual(['saved', 'sent:ended']);
  });

  it('ends a live call when an admin switches voice off', async () => {
    await call();
    const keepTalking = setInterval(speak, 1000);
    allowed = false;
    await vi.advanceTimersByTimeAsync(15_000);
    clearInterval(keepTalking);
    expect(endedWith()).toEqual({ type: 'ended', reason: 'DISABLED_BY_ADMIN' });
  });

  it('keeps the transcript, stores a ticket suggestion for this author only, and tells the caller', async () => {
    await call();
    provider.emit({
      type: 'transcript',
      role: 'AUTHOR',
      text: 'My payout is missing for last quarter please',
    });
    provider.emit({
      type: 'tool_call',
      callId: 'c1',
      name: 'suggest_ticket',
      argumentsJson: JSON.stringify({
        subject: 'Missing payout',
        description: 'My payout for last quarter has not arrived. Please check it for me.',
        book_id: 'not-my-book',
      }),
    });
    expect(sent).toContainEqual({ type: 'ticket_suggested' });
    expect(provider.toolResults[0]?.result).toMatchObject({ status: 'prepared' });
    provider.emit({
      type: 'transcript',
      role: 'ASSISTANT',
      text: 'Done, you can review it after the call.',
    });
    provider.emit({ type: 'usage', inputTokens: 100, outputTokens: 50 });
    provider.emit({ type: 'tool_call', callId: 'c2', name: 'end_call', argumentsJson: '{}' });
    provider.emit({ type: 'audio', pcm16: Buffer.from([1, 2]) });
    provider.emit({ type: 'reply_done' });
    await vi.advanceTimersByTimeAsync(0);
    const o = outcomes[0];
    expect(o?.reason).toBe('ASSISTANT_ENDED');
    expect(o?.proposal).toEqual({
      subject: 'Missing payout',
      description: 'My payout for last quarter has not arrived. Please check it for me.',
      bookId: null,
    });
    expect(o?.transcript.map((l) => l.role)).toEqual(['AUTHOR', 'ASSISTANT']);
    expect(o).toMatchObject({ inputTokens: 100, outputTokens: 50 });
  });

  it('lets the goodbye play: the reply carrying end_call does not hang up', async () => {
    await call();
    provider.emit({ type: 'tool_call', callId: 'c', name: 'end_call', argumentsJson: '{}' });
    provider.emit({ type: 'reply_done' });
    await vi.advanceTimersByTimeAsync(0);
    expect(endedWith()).toBeUndefined();
    provider.emit({ type: 'audio', pcm16: Buffer.from([5, 6]) });
    provider.emit({ type: 'reply_done' });
    await vi.advanceTimersByTimeAsync(0);
    expect(audioOut).toContainEqual(Buffer.from([5, 6]));
    expect(endedWith()).toEqual({ type: 'ended', reason: 'ASSISTANT_ENDED' });
  });

  it('keeps the call (and the server) running when the switch re-check fails', async () => {
    await call();
    const keepTalking = setInterval(speak, 1000);
    allowed = 'throws';
    await vi.advanceTimersByTimeAsync(31_000);
    expect(endedWith()).toBeUndefined();
    expect(warnings).toContain('could not re-check the voice switch');
    allowed = false;
    await vi.advanceTimersByTimeAsync(15_000);
    clearInterval(keepTalking);
    expect(endedWith()).toEqual({ type: 'ended', reason: 'DISABLED_BY_ADMIN' });
  });

  it('still tells the browser the call ended when saving fails', async () => {
    const handle = await call();
    saveFails = true;
    handle.onCallerHangup();
    await vi.advanceTimersByTimeAsync(0);
    expect(warnings).toContain('failed to save the voice call outcome');
    expect(endedWith()).toEqual({ type: 'ended', reason: 'USER_HANGUP' });
    expect(callerClosed).toBe(true);
  });

  it('hangs up after end_call even if the goodbye never finishes', async () => {
    const handle = await call();
    handle.onCallerAudio(Buffer.from([0]));
    provider.emit({ type: 'tool_call', callId: 'c', name: 'end_call', argumentsJson: '{}' });
    await vi.advanceTimersByTimeAsync(8_000);
    expect(endedWith()).toEqual({ type: 'ended', reason: 'ASSISTANT_ENDED' });
  });

  it('forwards barge-in, ends once on hang-up, and reports provider failures', async () => {
    const handle = await call();
    provider.emit({ type: 'barge_in' });
    expect(sent).toContainEqual({ type: 'interrupt' });
    handle.onCallerHangup();
    handle.onCallerGone();
    await vi.advanceTimersByTimeAsync(0);
    expect(outcomes.map((o) => o.reason)).toEqual(['USER_HANGUP']);
    provider.failNextConnect = 'VOICE_AUTH';
    sent = [];
    await call();
    expect(endedWith()).toEqual({ type: 'ended', reason: 'PROVIDER_ERROR' });
  });
});
