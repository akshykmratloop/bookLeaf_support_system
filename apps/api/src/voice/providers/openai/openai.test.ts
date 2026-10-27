import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer, type WebSocket as ServerSocket } from 'ws';
import type { VoiceEvent } from '../types.js';
import { handleServerEvent, initialState, requestReply, sessionUpdate } from './protocol.js';
import { openAiVoiceProvider } from './provider.js';

const CONFIG = {
  instructions: 'Be brief.',
  tools: [],
  language: 'en',
  greeting: 'Hi Priya, this is BookLeaf support.',
};
const update = sessionUpdate(CONFIG, 'marin');
const step = (s: ReturnType<typeof initialState>, m: Record<string, unknown>, now = 0) =>
  handleServerEvent(s, m, now, { update });

describe('OpenAI Realtime protocol rules', () => {
  it('configures PCM16 24 kHz audio, server turn detection with barge-in, and transcription', () => {
    const session = (update as unknown as { session: Record<string, unknown> }).session;
    expect(session).toMatchObject({
      type: 'realtime',
      output_modalities: ['audio'],
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          turn_detection: { type: 'server_vad', interrupt_response: true },
          transcription: { language: 'en' },
        },
        output: { voice: 'marin', format: { type: 'audio/pcm', rate: 24000 } },
      },
    });
  });

  it('sends session.update on session.created and is ready only after session.updated', () => {
    const s = initialState();
    expect(step(s, { type: 'session.created' }).send).toEqual([update]);
    expect(s.ready).toBe(false);
    step(s, { type: 'session.updated' });
    expect(s.ready).toBe(true);
  });

  it('queues a reply request while one is active and sends it after response.done', () => {
    const s = initialState();
    expect(requestReply(s, 'first')).toHaveLength(1);
    expect(requestReply(s, 'second')).toHaveLength(0);
    const done = step(s, { type: 'response.done', response: { status: 'completed' } });
    expect(done.send).toHaveLength(1);
    expect(JSON.stringify(done.send[0])).toContain('second');
    expect(s.responseActive).toBe(true);
  });

  it('on barge-in: tells the caller side, truncates what was played, and drops late audio', () => {
    const s = initialState();
    step(s, { type: 'response.created' });
    const audio = Buffer.alloc(4800).toString('base64'); // 100 ms at 24 kHz
    expect(
      step(s, { type: 'response.output_audio.delta', item_id: 'i1', delta: audio }, 1000).events,
    ).toHaveLength(1);
    const barge = step(s, { type: 'input_audio_buffer.speech_started' }, 1050);
    expect(barge.events).toEqual([{ type: 'barge_in' }]);
    expect(barge.send[0]).toMatchObject({
      type: 'conversation.item.truncate',
      item_id: 'i1',
      audio_end_ms: 50,
    });
    expect(
      step(s, { type: 'response.output_audio.delta', item_id: 'i1', delta: audio }).events,
    ).toEqual([]);
    step(s, { type: 'response.done', response: { status: 'cancelled' } });
    expect(
      step(s, { type: 'response.output_audio.delta', item_id: 'i2', delta: audio }).events,
    ).toHaveLength(1);
  });

  it('resolves the tool name from the earlier function_call item', () => {
    const s = initialState();
    step(s, {
      type: 'conversation.item.added',
      item: { type: 'function_call', call_id: 'c1', name: 'end_call' },
    });
    const call = step(s, {
      type: 'response.function_call_arguments.done',
      call_id: 'c1',
      arguments: '{}',
    });
    expect(call.events).toEqual([
      { type: 'tool_call', callId: 'c1', name: 'end_call', argumentsJson: '{}' },
    ]);
  });

  it('ignores benign errors and reports others; reports token usage', () => {
    const s = initialState();
    expect(
      step(s, { type: 'error', error: { code: 'response_cancel_not_active' } }).events,
    ).toEqual([]);
    expect(step(s, { type: 'error', error: { code: 'server_error' } }).events[0]).toMatchObject({
      type: 'error',
    });
    const done = step(s, {
      type: 'response.done',
      response: { usage: { input_tokens: 10, output_tokens: 20 } },
    });
    expect(done.events).toContainEqual({ type: 'usage', inputTokens: 10, outputTokens: 20 });
  });
});

describe('OpenAI Realtime over a raw WebSocket (local fake server)', () => {
  let server: WebSocketServer | undefined;
  afterEach(() => server?.close());

  function fakeServer(
    onClient: (ws: ServerSocket, auth: string, url: string) => void,
  ): Promise<string> {
    return new Promise((resolve) => {
      server = new WebSocketServer({ port: 0 }, () =>
        resolve(`ws://127.0.0.1:${(server?.address() as AddressInfo).port}/v1/realtime`),
      );
      server.on('connection', (ws, req) =>
        onClient(ws, req.headers.authorization ?? '', req.url ?? ''),
      );
    });
  }

  it('authenticates, completes the setup handshake and streams audio both ways', async () => {
    const received: string[] = [];
    let seen = { auth: '', url: '' };
    const url = await fakeServer((ws, auth, reqUrl) => {
      seen = { auth, url: reqUrl };
      ws.send(JSON.stringify({ type: 'session.created' }));
      ws.on('message', (raw) => {
        const m = JSON.parse(raw.toString()) as { type: string; audio?: string };
        received.push(m.type);
        if (m.type === 'session.update') {
          ws.send(JSON.stringify({ type: 'session.updated' }));
          ws.send(
            JSON.stringify({
              type: 'response.output_audio.delta',
              item_id: 'a',
              delta: Buffer.from([1, 2]).toString('base64'),
            }),
          );
        }
      });
    });
    const events: VoiceEvent[] = [];
    const provider = openAiVoiceProvider({
      apiKey: 'test-key',
      model: 'gpt-realtime-2.1',
      voice: 'marin',
      url,
    });
    const session = await provider.connect(CONFIG, (e) => events.push(e));
    session.sendAudio(Buffer.from([0, 0, 1, 0]));
    session.sendAudio(Buffer.alloc(0));
    await new Promise((r) => setTimeout(r, 100));
    session.close();
    expect(seen.auth).toBe('Bearer test-key');
    expect(seen.url).toContain('model=gpt-realtime-2.1');
    expect(received).toEqual(['session.update', 'input_audio_buffer.append']);
    expect(events[0]).toEqual({ type: 'audio', pcm16: Buffer.from([1, 2]) });
  });

  it('greets with the exact configured line, so the author is greeted by name', async () => {
    const sent: { type: string; response?: { instructions?: string } }[] = [];
    const url = await fakeServer((ws) => {
      ws.send(JSON.stringify({ type: 'session.created' }));
      ws.on('message', (raw) => {
        const m = JSON.parse(raw.toString()) as (typeof sent)[number];
        sent.push(m);
        if (m.type === 'session.update') ws.send(JSON.stringify({ type: 'session.updated' }));
      });
    });
    const provider = openAiVoiceProvider({ apiKey: 'k', model: 'm', voice: 'marin', url });
    const session = await provider.connect(CONFIG, () => undefined);
    session.greet();
    await new Promise((r) => setTimeout(r, 100));
    session.close();
    const reply = sent.find((m) => m.type === 'response.create');
    expect(reply?.response?.instructions).toContain('Hi Priya, this is BookLeaf support.');
    expect(reply?.response?.instructions).toMatch(/^Say exactly/);
  });

  it('reports a rejected key as VOICE_AUTH and a silent server as VOICE_UNAVAILABLE', async () => {
    server = new WebSocketServer({ port: 0, verifyClient: (_i, cb) => cb(false, 401) });
    await new Promise((r) => server?.on('listening', r));
    const authUrl = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/v1/realtime`;
    const p1 = openAiVoiceProvider({ apiKey: 'bad', model: 'm', voice: 'v', url: authUrl });
    await expect(p1.connect(CONFIG, () => undefined)).rejects.toMatchObject({ code: 'VOICE_AUTH' });
    server.close();
    const silentUrl = await fakeServer(() => undefined);
    const p2 = openAiVoiceProvider({
      apiKey: 'k',
      model: 'm',
      voice: 'v',
      url: silentUrl,
      connectTimeoutMs: 200,
    });
    await expect(p2.connect(CONFIG, () => undefined)).rejects.toMatchObject({
      code: 'VOICE_UNAVAILABLE',
    });
  });
});
