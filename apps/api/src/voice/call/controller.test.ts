import type { TicketDraft, VoiceServerMessage } from '@bookleaf/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeVoiceProvider, type FakeVoiceProvider } from '../providers/fake/provider.js';
import { startCall, TIME_WARNING, type CallOutcome } from './controller.js';
import type { DraftPort, DraftUpdate } from './types.js';

const LIMITS = {
  maxSeconds: 300,
  warnBeforeEndSeconds: 30,
  idleSeconds: 45,
  recheckSeconds: 15,
  goodbyeSeconds: 8,
};
const DRAFT: TicketDraft = {
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
};

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
let draftRuns: { name: string; args: string }[];
let draftListener: ((u: DraftUpdate) => void) | null;
let unwatched: boolean;

const port: DraftPort = {
  initial: DRAFT,
  run: async (name, args) => {
    draftRuns.push({ name, args });
    return { status: 'updated' };
  },
  watch: (fn) => {
    draftListener = fn;
    return () => {
      unwatched = true;
      draftListener = null;
    };
  },
};

/** Speech detected by the provider: the only thing that counts as the caller being there. */
const speak = () => provider.emit({ type: 'barge_in' });

async function call() {
  return startCall({
    provider,
    config: { instructions: 'x', tools: [], language: 'en', greeting: 'Hi' },
    draft: port,
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
  draftRuns = [];
  draftListener = null;
  unwatched = false;
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

  it('keeps the transcript and token use, and saves them when the assistant ends the call', async () => {
    await call();
    provider.emit({ type: 'transcript', role: 'AUTHOR', text: 'My payout is missing' });
    provider.emit({ type: 'transcript', role: 'ASSISTANT', text: 'I have started a ticket.' });
    const reply = { textIn: 10, audioIn: 90, cachedTextIn: 0, cachedAudioIn: 0, textOut: 5 };
    provider.emit({ type: 'usage', usage: { ...reply, audioOut: 45 } });
    provider.emit({ type: 'usage', usage: { ...reply, cachedAudioIn: 30, audioOut: 5 } });
    provider.emit({ type: 'tool_call', callId: 'c2', name: 'end_call', argumentsJson: '{}' });
    provider.emit({ type: 'audio', pcm16: Buffer.from([1, 2]) });
    provider.emit({ type: 'reply_done' });
    await vi.advanceTimersByTimeAsync(0);
    const o = outcomes[0];
    expect(o?.reason).toBe('ASSISTANT_ENDED');
    expect(o?.transcript.map((l) => l.role)).toEqual(['AUTHOR', 'ASSISTANT']);
    // Every reply's tokens are summed over the call, kept split for pricing.
    expect(o?.usage).toEqual({
      textIn: 20,
      audioIn: 180,
      cachedTextIn: 0,
      cachedAudioIn: 30,
      textOut: 10,
      audioOut: 50,
    });
    expect(unwatched).toBe(true);
  });

  it('shows the draft when the call is ready and runs draft tools on the server', async () => {
    await call();
    expect(sent[1]).toEqual({ type: 'draft', draft: DRAFT });
    const args = JSON.stringify({ subject: 'Missing payout' });
    provider.emit({
      type: 'tool_call',
      callId: 't1',
      name: 'update_ticket_draft',
      argumentsJson: args,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(draftRuns).toEqual([{ name: 'update_ticket_draft', args }]);
    expect(provider.toolResults).toEqual([{ callId: 't1', result: { status: 'updated' } }]);
  });

  it('sends only after confirm_ticket and an answer from the author in this call', async () => {
    await call();
    const submit = (id: string) =>
      provider.emit({ type: 'tool_call', callId: id, name: 'submit_ticket', argumentsJson: '{}' });
    submit('s1');
    provider.emit({ type: 'tool_call', callId: 'c1', name: 'confirm_ticket', argumentsJson: '{}' });
    submit('s2');
    provider.emit({ type: 'transcript', role: 'AUTHOR', text: 'Yes please' });
    submit('s3');
    await vi.advanceTimersByTimeAsync(0);
    expect(draftRuns.map((r) => r.name)).toEqual(['confirm_ticket', 'submit_ticket']);
    const refused = provider.toolResults.filter((r) => r.result.code === 'NO_ANSWER_YET');
    expect(refused.map((r) => r.callId)).toEqual(['s1', 's2']);
  });

  it("does not take noise or an empty line as the author's yes", async () => {
    await call();
    provider.emit({ type: 'tool_call', callId: 'c1', name: 'confirm_ticket', argumentsJson: '{}' });
    provider.emit({ type: 'barge_in' });
    provider.emit({ type: 'transcript', role: 'AUTHOR', text: '   ' });
    provider.emit({ type: 'tool_call', callId: 's1', name: 'submit_ticket', argumentsJson: '{}' });
    await vi.advanceTimersByTimeAsync(0);
    expect(draftRuns.map((r) => r.name)).toEqual(['confirm_ticket']);
    expect(provider.toolResults.find((r) => r.callId === 's1')?.result.code).toBe('NO_ANSWER_YET');
  });

  it("puts every draft change on screen and tells the model about the author's own edits", async () => {
    await call();
    const confirmed = {
      ...DRAFT,
      subject: 'Missing payout',
      status: 'AWAITING_CONFIRMATION' as const,
    };
    draftListener?.({ draft: confirmed, by: 'ASSISTANT', changed: ['status'] });
    expect(provider.context).toEqual([]);
    const edited = { ...confirmed, subject: 'Payout not received', status: 'OPEN' as const };
    draftListener?.({ draft: edited, by: 'AUTHOR', changed: ['subject'] });
    expect(
      sent.filter((m) => m.type === 'draft').map((m) => m.type === 'draft' && m.draft.subject),
    ).toEqual(['', 'Missing payout', 'Payout not received']);
    expect(provider.context).toHaveLength(1);
    expect(provider.context[0]).toContain('subject: "Payout not received"');
    expect(provider.context[0]).toContain('no longer counts');
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
