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
let arjun: string;
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

/** Polls until the check passes (socket messages and tool results arrive asynchronously). */
async function waitUntil(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out waiting for ${what}`);
}

const draftsSeen = (c: Client) => c.messages.flatMap((m) => (m.type === 'draft' ? [m.draft] : []));
const toolResult = (callId: string) => fake.toolResults.find((r) => r.callId === callId)?.result;

function tool(callId: string, name: string, args: Record<string, unknown> = {}) {
  fake.emit({ type: 'tool_call', callId, name, argumentsJson: JSON.stringify(args) });
}

beforeAll(async () => {
  h = await createHarness();
  if (!h.voice) throw new Error('voice harness missing');
  fake = h.voice;
  await h.app.listen({ port: 0, host: '127.0.0.1' });
  base = `ws://127.0.0.1:${(h.app.server.address() as AddressInfo).port}`;
  [priya, kavita, rohit, arjun, admin] = await Promise.all([
    h.login(EMAILS.priya),
    h.login(EMAILS.kavita),
    h.login(EMAILS.rohit),
    h.login(EMAILS.arjun),
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

  it('a call that never connected is replaced by a new one, not blocking the author', async () => {
    const abandoned = await startCall(kavita);
    const retry = await call(h, 'POST', '/voice/calls', kavita);
    expect(retry.statusCode).toBe(201);
    const old = await h.db.voiceSession.findUniqueOrThrow({ where: { id: abandoned.id } });
    expect(old.status).toBe('EXPIRED');
    const stale = connect(abandoned.socketPath, kavita);
    expect(await stale.closed).toBe(4409);
    await h.db.voiceSession.update({
      where: { id: retry.json<StartVoiceCall>().id },
      data: { status: 'EXPIRED' },
    });
  });

  it('allows one connected call at a time per author (409) and admins cannot call (403)', async () => {
    const first = await startCall(kavita);
    await h.db.voiceSession.update({
      where: { id: first.id },
      data: { status: 'ACTIVE', startedAt: new Date() },
    });
    const second = await call(h, 'POST', '/voice/calls', kavita);
    expect(second.statusCode).toBe(409);
    expect(second.json<{ code: string }>().code).toBe('VOICE_CALL_ACTIVE');
    expect((await call(h, 'POST', '/voice/calls', admin)).statusCode).toBe(403);
    await h.db.voiceSession.update({ where: { id: first.id }, data: { status: 'ENDED' } });
  });

  it('allows 5 connected calls per hour, then refuses the 6th (429)', async () => {
    const author = await h.db.author.findFirstOrThrow({ where: { user: { email: EMAILS.rohit } } });
    const now = new Date();
    const ended = (n: number) =>
      h.db.voiceSession.createMany({
        data: Array.from({ length: n }, () => ({
          authorId: author.id,
          provider: 'fake',
          model: 'fake',
          maxSeconds: 300,
          status: 'ENDED' as const,
          startedAt: now,
          endedAt: now,
        })),
      });
    await ended(4);
    const fifth = await call(h, 'POST', '/voice/calls', rohit);
    expect(fifth.statusCode).toBe(201);
    const { id } = fifth.json<StartVoiceCall>();
    await h.db.voiceSession.update({
      where: { id },
      data: { status: 'ENDED', startedAt: now, endedAt: now },
    });
    const res = await call(h, 'POST', '/voice/calls', rohit);
    expect(res.statusCode).toBe(429);
    expect(res.json<{ code: string; title: string }>()).toMatchObject({
      code: 'VOICE_HOURLY_LIMIT',
      title: expect.stringContaining('5 calls per hour'),
    });
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

  it('runs a full call: audio both ways, transcript, hang-up, saved record', async () => {
    const started = await startCall(priya);
    const c = connect(started.socketPath, priya);
    expect(await c.waitFor('ready')).toEqual({ type: 'ready', maxSeconds: 300 });
    expect(fake.config?.instructions).toContain('VERIFIED FACTS');
    expect(fake.config?.greeting).toMatch(/^Hi Priya, this is BookLeaf support/);
    expect(fake.config?.tools.map((t) => t.name)).toEqual([
      'update_ticket_draft',
      'confirm_ticket',
      'submit_ticket',
      'end_call',
    ]);
    c.ws.send(Buffer.alloc(960));
    fake.emit({ type: 'audio', pcm16: Buffer.from([7, 7]) });
    fake.emit({ type: 'transcript', role: 'AUTHOR', text: 'My royalty statement looks wrong' });
    fake.emit({ type: 'transcript', role: 'ASSISTANT', text: 'You have ₹99,999 pending.' });
    c.ws.send(JSON.stringify({ type: 'hangup' }));
    expect(await c.closed).toBe(1000);
    expect(c.messages).toContainEqual({ type: 'ended', reason: 'USER_HANGUP' });
    expect(fake.audioIn[0]?.length).toBe(960);
    expect(c.audio[0]).toEqual(Buffer.from([7, 7]));
    // No waiting: the record is saved before "ended" is sent, so the after-call view finds it.
    const saved = (await call(h, 'GET', `/voice/calls/${started.id}`, priya)).json<VoiceCall>();
    expect(saved).toMatchObject({ status: 'ENDED', endReason: 'USER_HANGUP' });
    expect(saved.transcript.map((l) => l.role)).toEqual(['AUTHOR', 'ASSISTANT']);
    expect(saved.threadId).toBe(started.id);
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

describe('voice: live ticket draft', () => {
  it("fills the draft live, hears the author's screen edits, and sends only after asking", async () => {
    const started = await startCall(arjun);
    const c = connect(started.socketPath, arjun);
    await c.waitFor('ready');
    await waitUntil(() => draftsSeen(c).length === 1, 'the initial draft');
    const draftId = draftsSeen(c)[0]?.id ?? '';
    tool('d1', 'update_ticket_draft', {
      category: 'ROYALTY_PAYMENTS',
      subject: 'Payout missing',
      description: 'My payout for last quarter has not arrived yet.',
    });
    await waitUntil(() => draftsSeen(c).some((d) => d.subject === 'Payout missing'), 'tool edit');
    expect(toolResult('d1')).toMatchObject({ status: 'updated' });
    await call(h, 'PATCH', `/ticket-drafts/${draftId}`, arjun, { subject: 'Payout not received' });
    await waitUntil(() => draftsSeen(c).at(-1)?.lastEditedBy === 'AUTHOR', 'screen edit shown');
    expect(fake.context.at(-1)).toContain('Payout not received');
    tool('d2', 'submit_ticket');
    await waitUntil(() => Boolean(toolResult('d2')), 'early submit result');
    expect(toolResult('d2')).toMatchObject({ code: 'NO_ANSWER_YET' });
    tool('d3', 'confirm_ticket');
    await waitUntil(() => Boolean(toolResult('d3')), 'confirm result');
    // Confirm then submit in one breath, with no answer from the author, is refused.
    tool('d4', 'submit_ticket');
    await waitUntil(() => Boolean(toolResult('d4')), 'same-turn submit result');
    expect(toolResult('d4')).toMatchObject({ code: 'NO_ANSWER_YET' });
    expect(await h.db.ticket.count({ where: { voiceSessionId: started.id } })).toBe(0);
    fake.emit({ type: 'transcript', role: 'AUTHOR', text: 'Yes, send it' });
    tool('d5', 'submit_ticket');
    await waitUntil(() => Boolean(toolResult('d5')), 'submit result');
    expect(toolResult('d5')).toMatchObject({ status: 'sent' });
    const ticket = await h.db.ticket.findUniqueOrThrow({ where: { voiceSessionId: started.id } });
    expect(ticket).toMatchObject({ source: 'VOICE', subject: 'Payout not received' });
    c.ws.send(JSON.stringify({ type: 'hangup' }));
    await c.closed;
    // The ticket was sent, so there is nothing to continue.
    expect((await call(h, 'GET', '/voice/calls/resumable', arjun)).json()).toBeNull();
  });

  it('continues a dropped call with the same conversation and draft, within the hour', async () => {
    const first = await startCall(arjun);
    const a = connect(first.socketPath, arjun);
    await a.waitFor('ready');
    fake.emit({ type: 'transcript', role: 'AUTHOR', text: 'My printed copies arrived damaged' });
    fake.emit({ type: 'transcript', role: 'ASSISTANT', text: 'Sorry about that.' });
    tool('r1', 'update_ticket_draft', { subject: 'Damaged printed copies' });
    await waitUntil(() => Boolean(toolResult('r1')), 'draft edit');
    a.ws.close();
    await a.closed;
    await settle();
    const resumable = (await call(h, 'GET', '/voice/calls/resumable', arjun)).json<VoiceCall>();
    expect(resumable).toMatchObject({ id: first.id, draft: { subject: 'Damaged printed copies' } });
    const res = await call(h, 'POST', '/voice/calls', arjun, { resume: true });
    expect(res.statusCode).toBe(201);
    const second = res.json<StartVoiceCall>();
    const b = connect(second.socketPath, arjun);
    await b.waitFor('ready');
    expect(fake.config?.greeting).toMatch(/^Welcome back Arjun/);
    expect(fake.config?.instructions).toContain('EARLIER IN THIS CALL');
    expect(fake.config?.instructions).toContain('My printed copies arrived damaged');
    await waitUntil(() => draftsSeen(b).length > 0, 'the draft');
    expect(draftsSeen(b)[0]).toMatchObject({
      id: resumable.draft?.id,
      subject: 'Damaged printed copies',
    });
    fake.emit({ type: 'transcript', role: 'AUTHOR', text: 'Yes, three copies' });
    b.ws.send(JSON.stringify({ type: 'hangup' }));
    await b.closed;
    const row = await h.db.voiceSession.findUniqueOrThrow({ where: { id: second.id } });
    expect(row.threadId).toBe(first.id);
    const adminView = (
      await call(h, 'GET', `/admin/voice/calls/${second.id}`, admin)
    ).json<AdminVoiceCall>();
    expect(adminView.transcript.map((l) => l.text)).toEqual([
      'My printed copies arrived damaged',
      'Sorry about that.',
      'Yes, three copies',
    ]);
  });

  it('offers nothing to continue when only the greeting was said', async () => {
    const started = await startCall(arjun);
    const c = connect(started.socketPath, arjun);
    await c.waitFor('ready');
    fake.emit({
      type: 'transcript',
      role: 'ASSISTANT',
      text: 'Hi Arjun, this is BookLeaf support.',
    });
    c.ws.send(JSON.stringify({ type: 'hangup' }));
    await c.closed;
    expect((await call(h, 'GET', '/voice/calls/resumable', arjun)).json()).toBeNull();
  });

  it('offers nothing to continue after an hour (and refuses resume: 409)', async () => {
    const last = await h.db.voiceSession.findFirstOrThrow({
      where: { author: { user: { email: EMAILS.arjun } } },
      orderBy: { createdAt: 'desc' },
    });
    await h.db.voiceSession.update({
      where: { id: last.id },
      data: { endedAt: new Date(Date.now() - 61 * 60_000) },
    });
    expect((await call(h, 'GET', '/voice/calls/resumable', arjun)).json()).toBeNull();
    const res = await call(h, 'POST', '/voice/calls', arjun, { resume: true });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('VOICE_NOTHING_TO_RESUME');
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
