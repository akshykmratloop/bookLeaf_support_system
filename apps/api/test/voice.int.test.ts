import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type {
  AdminVoiceCall,
  AssistantSettings,
  StartVoiceCall,
  VoiceCall,
  VoiceServerMessage,
} from '@bookleaf/shared';
import type { FakeVoiceProvider } from '../src/voice/providers/fake/provider.js';
import { call, createHarness, EMAILS, ORIGIN, type Harness } from './helpers/app.js';

let h: Harness;
let fake: FakeVoiceProvider;
let base: string;
let priya: string;
let kavita: string;
let rohit: string;
let admin: string;

async function setVoice(voiceEnabled: boolean) {
  const { settings } = (await call(h, 'GET', '/admin/assistant', admin)).json<{
    settings: AssistantSettings;
  }>();
  await call(h, 'PUT', '/admin/assistant/settings', admin, {
    version: settings.version,
    voiceEnabled,
  });
}

async function startCall(cookie: string): Promise<StartVoiceCall> {
  const res = await call(h, 'POST', '/voice/calls', cookie);
  expect(res.statusCode).toBe(201);
  return res.json<StartVoiceCall>();
}

interface Client {
  ws: WebSocket;
  messages: VoiceServerMessage[];
  audio: Buffer[];
  closed: Promise<number>;
  waitFor(type: VoiceServerMessage['type']): Promise<VoiceServerMessage>;
}

function connect(path: string, cookie: string, origin = ORIGIN): Client {
  const ws = new WebSocket(`${base}${path}`, { headers: { cookie, origin } });
  const messages: VoiceServerMessage[] = [];
  const audio: Buffer[] = [];
  ws.on('message', (data, isBinary) => {
    if (isBinary) audio.push(data as Buffer);
    else messages.push(JSON.parse(data.toString()) as VoiceServerMessage);
  });
  const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
  ws.on('error', () => undefined);
  const waitFor = async (type: VoiceServerMessage['type']) => {
    for (let i = 0; i < 100; i += 1) {
      const m = messages.find((x) => x.type === type);
      if (m) return m;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`no ${type} message`);
  };
  return { ws, messages, audio, closed, waitFor };
}

const settle = () => new Promise((r) => setTimeout(r, 150));

beforeAll(async () => {
  h = await createHarness();
  if (!h.voice) throw new Error('voice harness missing');
  fake = h.voice;
  await h.app.listen({ port: 0, host: '127.0.0.1' });
  base = `ws://127.0.0.1:${(h.app.server.address() as AddressInfo).port}`;
  [priya, kavita, rohit, admin] = await Promise.all([
    h.login(EMAILS.priya),
    h.login(EMAILS.kavita),
    h.login(EMAILS.rohit),
    h.login(EMAILS.admin),
  ]);
});
afterAll(() => h.close());

describe('voice: admin control and limits', () => {
  it('is off by default (403) and available once an admin switches it on', async () => {
    const off = await call(h, 'POST', '/voice/calls', priya);
    expect(off.statusCode).toBe(403);
    expect(off.json<{ code: string }>().code).toBe('FEATURE_DISABLED');
    await setVoice(true);
    const av = (await call(h, 'GET', '/assistant/availability', priya)).json<{
      voice: { state: string; maxCallSeconds: number };
    }>();
    expect(av.voice).toMatchObject({ state: 'AVAILABLE', maxCallSeconds: 300 });
  });

  it('allows one call at a time per author (409) and admins cannot call (403)', async () => {
    const first = await startCall(kavita);
    const second = await call(h, 'POST', '/voice/calls', kavita);
    expect(second.statusCode).toBe(409);
    expect(second.json<{ code: string }>().code).toBe('VOICE_CALL_ACTIVE');
    expect((await call(h, 'POST', '/voice/calls', admin)).statusCode).toBe(403);
    await h.db.voiceSession.update({ where: { id: first.id }, data: { status: 'EXPIRED' } });
  });

  it('enforces the hourly limit of connected calls (429)', async () => {
    const author = await h.db.author.findFirstOrThrow({ where: { user: { email: EMAILS.rohit } } });
    const now = new Date();
    await h.db.voiceSession.createMany({
      data: Array.from({ length: 3 }, () => ({
        authorId: author.id,
        provider: 'fake',
        model: 'fake',
        maxSeconds: 300,
        status: 'ENDED' as const,
        startedAt: now,
        endedAt: now,
      })),
    });
    const res = await call(h, 'POST', '/voice/calls', rohit);
    expect(res.statusCode).toBe(429);
    expect(res.json<{ code: string }>().code).toBe('VOICE_HOURLY_LIMIT');
  });
});

describe('voice: the call socket', () => {
  it('refuses a socket from another site (Origin) and a call that is not yours', async () => {
    const mine = await startCall(priya);
    const foreign = connect(mine.socketPath, priya, 'https://evil.example');
    expect(await foreign.closed).not.toBe(1000);
    expect(fake.config).toBeNull();
    const anonymous = connect(mine.socketPath, '');
    expect(await anonymous.closed).not.toBe(1000);
    expect(fake.config).toBeNull();
    const stolen = connect(mine.socketPath, kavita);
    expect(await stolen.closed).toBe(4409);
    await h.db.voiceSession.update({ where: { id: mine.id }, data: { status: 'EXPIRED' } });
  });

  it('runs a full call: audio both ways, transcript, ticket suggestion, hang-up, saved record', async () => {
    const started = await startCall(priya);
    const c = connect(started.socketPath, priya);
    expect(await c.waitFor('ready')).toEqual({ type: 'ready', maxSeconds: 300 });
    expect(fake.config?.instructions).toContain('VERIFIED FACTS');
    expect(fake.config?.greeting).toMatch(/^Hi Priya, this is BookLeaf support/);
    expect(fake.config?.tools.map((t) => t.name)).toEqual(['suggest_ticket', 'end_call']);
    c.ws.send(Buffer.alloc(960));
    fake.emit({ type: 'audio', pcm16: Buffer.from([7, 7]) });
    fake.emit({ type: 'transcript', role: 'AUTHOR', text: 'My royalty statement looks wrong' });
    fake.emit({ type: 'transcript', role: 'ASSISTANT', text: 'You have ₹99,999 pending.' });
    fake.emit({
      type: 'tool_call',
      callId: 't1',
      name: 'suggest_ticket',
      argumentsJson: JSON.stringify({
        subject: 'Royalty statement looks wrong',
        description: 'My royalty statement for last quarter looks wrong. Please check it.',
        book_id: null,
      }),
    });
    await c.waitFor('ticket_suggested');
    c.ws.send(JSON.stringify({ type: 'hangup' }));
    expect(await c.closed).toBe(1000);
    expect(c.messages).toContainEqual({ type: 'ended', reason: 'USER_HANGUP' });
    expect(fake.audioIn[0]?.length).toBe(960);
    expect(c.audio[0]).toEqual(Buffer.from([7, 7]));
    // No waiting: the record is saved before "ended" is sent, so the after-call view finds it.
    const saved = (await call(h, 'GET', `/voice/calls/${started.id}`, priya)).json<VoiceCall>();
    expect(saved).toMatchObject({ status: 'ENDED', endReason: 'USER_HANGUP' });
    expect(saved.transcript.map((l) => l.role)).toEqual(['AUTHOR', 'ASSISTANT']);
    expect(saved.proposal?.subject).toBe('Royalty statement looks wrong');
    expect(await h.db.aiRun.count({ where: { task: 'VOICE' } })).toBeGreaterThan(0);
  });

  it('flags spoken figures that are not in the facts, and links one VOICE ticket per call', async () => {
    const callRow = await h.db.voiceSession.findFirstOrThrow({
      where: {
        status: 'ENDED',
        endReason: 'USER_HANGUP',
        author: { user: { email: EMAILS.priya } },
      },
    });
    const adminView = (
      await call(h, 'GET', `/admin/voice/calls/${callRow.id}`, admin)
    ).json<AdminVoiceCall>();
    expect(adminView.spokenCheck?.passed).toBe(false);
    expect(adminView.spokenCheck?.issues.map((i) => i.code)).toContain('UNSUPPORTED_AMOUNT');
    const body = {
      bookId: null,
      subject: 'Royalty statement looks wrong',
      description: 'My royalty statement for last quarter looks wrong. Please check it.',
    };
    const first = await call(h, 'POST', `/voice/calls/${callRow.id}/ticket`, priya, body);
    expect(first.statusCode).toBe(201);
    const again = await call(h, 'POST', `/voice/calls/${callRow.id}/ticket`, priya, body);
    expect(again.json<{ id: string }>().id).toBe(first.json<{ id: string }>().id);
    const ticket = (
      await call(h, 'GET', `/tickets/${first.json<{ id: string }>().id}`, admin)
    ).json<{
      source: string;
      voiceSessionId: string;
    }>();
    expect(ticket).toMatchObject({ source: 'VOICE', voiceSessionId: callRow.id });
  });

  it('ends cleanly with PROVIDER_ERROR when the voice provider cannot connect', async () => {
    fake.failNextConnect = 'VOICE_UNAVAILABLE';
    const started = await startCall(priya);
    const c = connect(started.socketPath, priya);
    await c.closed;
    expect(c.messages).toContainEqual({ type: 'ended', reason: 'PROVIDER_ERROR' });
    await settle();
    const saved = (await call(h, 'GET', `/voice/calls/${started.id}`, priya)).json<VoiceCall>();
    expect(saved.status).toBe('FAILED');
  });
});

describe('voice: not configured', () => {
  it('reports NOT_CONFIGURED and refuses calls (503) when the server has no voice key', async () => {
    // Same database, where an earlier test switched voice on: only the missing key differs.
    const bare = await createHarness({ voice: false });
    const p = await bare.login(EMAILS.priya);
    const av = (await call(bare, 'GET', '/assistant/availability', p)).json<{
      voice: { state: string };
    }>();
    expect(av.voice.state).toBe('NOT_CONFIGURED');
    const res = await call(bare, 'POST', '/voice/calls', p);
    expect(res.statusCode).toBe(503);
    await bare.close();
  });
});
