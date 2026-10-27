import WebSocket from 'ws';
import {
  VoiceProviderError,
  type VoiceEvent,
  type VoiceProvider,
  type VoiceSession,
  type VoiceSessionConfig,
} from '../types.js';
import {
  SAY_LINE,
  handleServerEvent,
  initialState,
  requestReply,
  sessionUpdate,
  type ClientEvent,
} from './protocol.js';

export interface OpenAiVoiceOptions {
  apiKey: string;
  model: string;
  voice: string;
  /** Override for tests (a local fake server). */
  url?: string;
  connectTimeoutMs?: number;
}

const DEFAULT_URL = 'wss://api.openai.com/v1/realtime';

/** OpenAI Realtime over a raw WebSocket (no SDK). Audio is PCM16 24 kHz both ways. */
export function openAiVoiceProvider(opts: OpenAiVoiceOptions): VoiceProvider {
  return {
    id: 'openai',
    model: opts.model,
    inputSampleRate: 24_000,
    outputSampleRate: 24_000,
    connect: (config, onEvent) => connect(opts, config, onEvent),
  };
}

function connect(
  opts: OpenAiVoiceOptions,
  config: VoiceSessionConfig,
  onEvent: (e: VoiceEvent) => void,
): Promise<VoiceSession> {
  const url = `${opts.url ?? DEFAULT_URL}?model=${encodeURIComponent(opts.model)}`;
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${opts.apiKey}` } });
  const state = initialState();
  const update = sessionUpdate(config, opts.voice);
  const send = (events: ClientEvent[]) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    for (const e of events) ws.send(JSON.stringify(e));
  };
  const session: VoiceSession = {
    sendAudio: (pcm16) => {
      if (pcm16.length > 0)
        send([{ type: 'input_audio_buffer.append', audio: pcm16.toString('base64') }]);
    },
    sendToolResult: (callId, result) => {
      send([
        {
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) },
        },
      ]);
      send(requestReply(state));
    },
    say: (text) => send(requestReply(state, SAY_LINE(text))),
    greet: () => send(requestReply(state, SAY_LINE(config.greeting))),
    close: () => ws.close(1000),
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err: VoiceProviderError) => {
      if (settled) return onEvent({ type: 'error', code: err.code, message: err.message });
      settled = true;
      clearTimeout(timer);
      ws.terminate();
      reject(err);
    };
    const timer = setTimeout(
      () =>
        fail(
          new VoiceProviderError('VOICE_UNAVAILABLE', 'Voice provider did not get ready in time'),
        ),
      opts.connectTimeoutMs ?? 10_000,
    );
    ws.on('unexpected-response', (_req, res) =>
      fail(
        new VoiceProviderError(
          res.statusCode === 401 || res.statusCode === 403 ? 'VOICE_AUTH' : 'VOICE_UNAVAILABLE',
          `Voice provider refused the connection (${res.statusCode ?? 'unknown'})`,
        ),
      ),
    );
    ws.on('error', () =>
      fail(new VoiceProviderError('VOICE_UNAVAILABLE', 'Voice provider unreachable')),
    );
    ws.on('close', () => {
      if (!settled)
        fail(new VoiceProviderError('VOICE_UNAVAILABLE', 'Voice provider closed the connection'));
      else onEvent({ type: 'closed' });
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      // Elapsed time only (for barge-in truncation), so a monotonic clock is right here.
      const step = handleServerEvent(state, msg, performance.now(), { update });
      send(step.send);
      if (!settled && state.ready) {
        settled = true;
        clearTimeout(timer);
        resolve(session);
      }
      for (const e of step.events) onEvent(e);
    });
  });
}
