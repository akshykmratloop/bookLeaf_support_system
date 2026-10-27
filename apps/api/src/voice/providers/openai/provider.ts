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
  contextItem,
  handleServerEvent,
  initialState,
  requestReply,
  sessionUpdate,
  type ClientEvent,
  type ProtocolState,
} from './protocol.js';

export interface OpenAiVoiceOptions {
  apiKey: string;
  model: string;
  voice: string;
  /** Override for tests (a local fake server). */
  url?: string;
  connectTimeoutMs?: number;
}

import { OPENAI_VOICES } from './voices.js';

const DEFAULT_URL = 'wss://api.openai.com/v1/realtime';

/** OpenAI Realtime over a raw WebSocket (no SDK). Audio is PCM16 24 kHz both ways. */
export function openAiVoiceProvider(opts: OpenAiVoiceOptions): VoiceProvider {
  return {
    id: 'openai',
    model: opts.model,
    inputSampleRate: 24_000,
    outputSampleRate: 24_000,
    voices: OPENAI_VOICES,
    connect: (config, onEvent) => connect(opts, config, onEvent),
  };
}

/** One open socket and the protocol state that goes with it. */
interface Link {
  ws: WebSocket;
  state: ProtocolState;
  update: ClientEvent;
  send: (events: ClientEvent[]) => void;
  onEvent: (e: VoiceEvent) => void;
}

interface Gate {
  fail: (err: VoiceProviderError) => void;
  ready: () => void;
  isSettled: () => boolean;
}

function openLink(
  opts: OpenAiVoiceOptions,
  config: VoiceSessionConfig,
  onEvent: (e: VoiceEvent) => void,
): Link {
  const url = `${opts.url ?? DEFAULT_URL}?model=${encodeURIComponent(opts.model)}`;
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${opts.apiKey}` } });
  const send = (events: ClientEvent[]) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    for (const e of events) ws.send(JSON.stringify(e));
  };
  return { ws, state: initialState(), update: sessionUpdate(config, opts.voice), send, onEvent };
}

function createSession({ ws, state, send }: Link, config: VoiceSessionConfig): VoiceSession {
  return {
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
    addContext: (text) => send([contextItem(text)]),
    close: () => ws.close(1000),
  };
}

const refusalError = (status: number | undefined) =>
  new VoiceProviderError(
    status === 401 || status === 403 ? 'VOICE_AUTH' : 'VOICE_UNAVAILABLE',
    `Voice provider refused the connection (${status ?? 'unknown'})`,
  );

/** The protocol only sends JSON text frames; anything else is not a server event and is skipped. */
function parseFrame(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function watchSocket(link: Link, gate: Gate): void {
  const { ws, onEvent } = link;
  ws.on('unexpected-response', (_req, res) => gate.fail(refusalError(res.statusCode)));
  ws.on('error', () =>
    gate.fail(new VoiceProviderError('VOICE_UNAVAILABLE', 'Voice provider unreachable')),
  );
  ws.on('close', () => {
    if (gate.isSettled()) return onEvent({ type: 'closed' });
    gate.fail(new VoiceProviderError('VOICE_UNAVAILABLE', 'Voice provider closed the connection'));
  });
  ws.on('message', (data, isBinary) => {
    const msg = isBinary ? null : parseFrame(data.toString());
    if (!msg) return;
    // Elapsed time only (for barge-in truncation), so a monotonic clock is right here.
    const step = handleServerEvent(link.state, msg, performance.now(), { update: link.update });
    link.send(step.send);
    gate.ready();
    for (const e of step.events) onEvent(e);
  });
}

/**
 * Resolves once the session is configured, or rejects if it fails first. After that, failures
 * arrive as `error` events instead.
 */
function connect(
  opts: OpenAiVoiceOptions,
  config: VoiceSessionConfig,
  onEvent: (e: VoiceEvent) => void,
): Promise<VoiceSession> {
  const link = openLink(opts, config, onEvent);
  const session = createSession(link, config);
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = () => {
      settled = true;
      clearTimeout(timer);
    };
    const fail = (err: VoiceProviderError) => {
      if (settled) return onEvent({ type: 'error', code: err.code, message: err.message });
      settle();
      link.ws.terminate();
      reject(err);
    };
    const ready = () => {
      if (settled || !link.state.ready) return;
      settle();
      resolve(session);
    };
    const timer = setTimeout(
      () =>
        fail(
          new VoiceProviderError('VOICE_UNAVAILABLE', 'Voice provider did not get ready in time'),
        ),
      opts.connectTimeoutMs ?? 10_000,
    );
    watchSocket(link, { fail, ready, isSettled: () => settled });
  });
}
