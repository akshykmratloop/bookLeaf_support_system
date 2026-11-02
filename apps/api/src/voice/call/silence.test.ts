import type { VoiceServerMessage } from '@bookleaf/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeVoiceProvider, type FakeVoiceProvider } from '../providers/fake/provider.js';
import { startCall, type CallHandle } from './controller.js';
import { SILENCE_LINES } from './silence.js';

const { stillThere, stillCantHear, onMute, silenceGoodbye, muteGoodbye } = SILENCE_LINES;
const LIMITS = {
  maxSeconds: 300,
  warnBeforeEndSeconds: 30,
  silenceNudgeSeconds: 15,
  recheckSeconds: 60,
  goodbyeSeconds: 8,
};

let provider: FakeVoiceProvider;
let sent: VoiceServerMessage[];

async function call(): Promise<CallHandle> {
  return startCall({
    provider,
    config: { instructions: 'x', tools: [], language: 'en', greeting: 'Hi' },
    draft: {
      initial: {
        id: '22222222-2222-4222-8222-222222222222',
        category: null,
        bookId: null,
        subject: '',
        description: '',
        status: 'OPEN',
        version: 0,
        lastEditedBy: 'ASSISTANT',
        isComplete: false,
        ticket: null,
        updatedAt: new Date(0).toISOString(),
      },
      run: async () => ({ status: 'updated' }),
      watch: () => () => undefined,
    },
    limits: LIMITS,
    caller: { sendAudio: () => undefined, send: (m) => sent.push(m), close: () => undefined },
    now: () => new Date(),
    isStillAllowed: async () => true,
    onEnd: async () => undefined,
    warn: () => undefined,
  });
}

const ended = () => sent.find((m) => m.type === 'ended');
const wait = (s: number) => vi.advanceTimersByTimeAsync(s * 1000);
/** The assistant speaks its line: audio arrives, then the reply finishes. */
const assistantSpeaks = () => {
  provider.emit({ type: 'audio', pcm16: Buffer.from([1, 2]) });
  provider.emit({ type: 'reply_done' });
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'],
  });
  provider = fakeVoiceProvider();
  sent = [];
});
afterEach(() => vi.useRealTimers());

describe('a silent author', () => {
  it('is asked twice, then told why the call ends, and the call ends after the goodbye', async () => {
    await call();
    await wait(15);
    expect(provider.said).toEqual([]);
    await wait(1);
    expect(provider.said).toEqual([stillThere]);
    await wait(16);
    expect(provider.said).toEqual([stillThere, stillCantHear]);
    await wait(16);
    expect(provider.said).toEqual([stillThere, stillCantHear, silenceGoodbye]);
    expect(ended()).toBeUndefined();
    assistantSpeaks();
    await wait(0);
    expect(ended()).toEqual({ type: 'ended', reason: 'IDLE' });
  });

  it('ends the call even when the goodbye never plays', async () => {
    await call();
    await wait(48);
    expect(provider.said.at(-1)).toBe(silenceGoodbye);
    await wait(8);
    expect(ended()).toEqual({ type: 'ended', reason: 'IDLE' });
  });

  it('starts over once the author speaks', async () => {
    await call();
    await wait(16);
    provider.emit({ type: 'barge_in' });
    provider.emit({ type: 'transcript', role: 'AUTHOR', text: 'Sorry, I am here' });
    await wait(16);
    expect(provider.said).toEqual([stillThere, stillThere]);
    expect(ended()).toBeUndefined();
  });

  it('is not nudged while the assistant is still talking', async () => {
    await call();
    const talking = setInterval(
      () => provider.emit({ type: 'audio', pcm16: Buffer.from([1]) }),
      1000,
    );
    await wait(40);
    clearInterval(talking);
    expect(provider.said).toEqual([]);
  });
});

describe('a muted author', () => {
  it('hears that they are on mute, and why the call ends', async () => {
    const handle = await call();
    handle.onCallerMute(true);
    await wait(48);
    expect(provider.said).toEqual([onMute, onMute, muteGoodbye]);
  });

  it('starts over after unmuting', async () => {
    const handle = await call();
    handle.onCallerMute(true);
    await wait(16);
    handle.onCallerMute(false);
    await wait(16);
    expect(provider.said).toEqual([onMute, stillThere]);
  });
});
