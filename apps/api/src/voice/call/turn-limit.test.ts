import type { TicketDraft, VoiceServerMessage } from '@bookleaf/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeVoiceProvider, type FakeVoiceProvider } from '../providers/fake/provider.js';
import { startCall, type CallOutcome } from './controller.js';
import { SILENCE_LINES } from './silence.js';
import { TURN_LIMIT_GOODBYE, TURN_LIMIT_GRACE_SECONDS } from './turn-limit.js';
import type { SpokenLines } from './types.js';

const DRAFT: TicketDraft = {
  id: '33333333-3333-4333-8333-333333333333',
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
};

let provider: FakeVoiceProvider;
let sent: VoiceServerMessage[];
let outcomes: CallOutcome[];

function call(turnsLeft: number | null, lines?: SpokenLines) {
  return startCall({
    lines,
    provider,
    config: { instructions: 'x', tools: [], language: 'en', greeting: 'Hi' },
    draft: { initial: DRAFT, run: async () => ({}), watch: () => () => undefined },
    limits: {
      maxSeconds: 300,
      warnBeforeEndSeconds: 30,
      silenceNudgeSeconds: 15,
      recheckSeconds: 15,
      goodbyeSeconds: 8,
      turnsLeft,
    },
    caller: { sendAudio: () => undefined, send: (m) => sent.push(m), close: () => undefined },
    now: () => new Date(),
    isStillAllowed: async () => true,
    onEnd: async (o) => {
      outcomes.push(o);
    },
    warn: () => undefined,
  });
}

/** One exchange: the author asks, the assistant answers out loud, the reply finishes. */
function exchange(question: string) {
  provider.emit({ type: 'transcript', role: 'AUTHOR', text: question });
  provider.emit({ type: 'audio', pcm16: Buffer.from([1, 1]) });
  provider.emit({ type: 'transcript', role: 'ASSISTANT', text: 'Here is your answer.' });
  provider.emit({ type: 'reply_done' });
}

const ended = () => sent.find((m) => m.type === 'ended');
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  provider = fakeVoiceProvider();
  sent = [];
  outcomes = [];
});
afterEach(() => vi.useRealTimers());

describe('the conversation limit on a call', () => {
  it('answers the last allowed question, then says so and ends with TURN_LIMIT', async () => {
    await call(2);
    exchange('When will I get paid?');
    expect(provider.said).not.toContain(TURN_LIMIT_GOODBYE);
    exchange('And my ISBN?');
    expect(provider.said).toContain(TURN_LIMIT_GOODBYE);
    expect(ended()).toBeUndefined();
    provider.emit({ type: 'audio', pcm16: Buffer.from([2, 2]) });
    provider.emit({ type: 'reply_done' });
    await flush();
    expect(ended()).toEqual({ type: 'ended', reason: 'TURN_LIMIT' });
    expect(outcomes[0]?.reason).toBe('TURN_LIMIT');
  });

  it('has no limit when the call is not part of a chat', async () => {
    await call(null);
    for (let i = 0; i < 6; i += 1) exchange(`Question ${i}`);
    await flush();
    expect(provider.said).not.toContain(TURN_LIMIT_GOODBYE);
    expect(ended()).toBeUndefined();
  });

  it('still ends if the answer or the goodbye never finishes', async () => {
    vi.useFakeTimers();
    await call(1);
    provider.emit({ type: 'transcript', role: 'AUTHOR', text: 'Hello?' });
    await vi.advanceTimersByTimeAsync(TURN_LIMIT_GRACE_SECONDS * 1000);
    expect(ended()).toEqual({ type: 'ended', reason: 'TURN_LIMIT' });
  });

  it("says the goodbye in the call's voice style", async () => {
    const goodbye = 'Is conversation ki limit poori ho gayi hai.';
    await call(1, { ...SILENCE_LINES, timeWarning: 'x', turnLimitGoodbye: goodbye });
    exchange('Hello?');
    expect(provider.said).toEqual([goodbye]);
  });

  it('waits for the final answer: a reply that only ran a tool, or was cut off, is not it', async () => {
    await call(1);
    provider.emit({ type: 'transcript', role: 'AUTHOR', text: 'Please raise a ticket' });
    provider.emit({ type: 'reply_done', final: false });
    expect(provider.said).not.toContain(TURN_LIMIT_GOODBYE);
    provider.emit({ type: 'audio', pcm16: Buffer.from([1, 1]) });
    provider.emit({ type: 'reply_done' });
    expect(provider.said).toContain(TURN_LIMIT_GOODBYE);
  });

  it('stops listening once the last allowed question was asked', async () => {
    const handle = await call(1);
    provider.emit({ type: 'transcript', role: 'AUTHOR', text: 'Last one' });
    handle.onCallerAudio(Buffer.from([5, 5]));
    expect(provider.audioIn).toHaveLength(0);
  });
});
