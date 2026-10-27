import type { VoiceEvent } from '../types.js';
import type { ClientEvent, ProtocolState, Step } from './protocol.js';

/**
 * OpenAI Realtime server events → domain events, as pure functions over the protocol state.
 * Each handler covers one event; handleServerEvent picks the handler by event type.
 */

const BENIGN_ERRORS = new Set([
  'response_cancel_not_active',
  'conversation_already_has_active_response',
]);
const BYTES_PER_MS = (24_000 * 2) / 1000;

type Msg = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const obj = (v: unknown): Msg => (v && typeof v === 'object' ? (v as Msg) : {});
const none = (): Step => ({ events: [], send: [] });

function onAudioDelta(s: ProtocolState, m: Msg, now: number): Step {
  if (s.muted) return none();
  const pcm16 = Buffer.from(str(m.delta), 'base64');
  const id = str(m.item_id);
  if (!s.item || s.item.id !== id) s.item = { id, firstAudioAt: now, bytes: 0 };
  s.item.bytes += pcm16.length;
  return { events: [{ type: 'audio', pcm16 }], send: [] };
}

function onSpeechStarted(s: ProtocolState, now: number): Step {
  const send: ClientEvent[] = [];
  if (s.responseActive && s.item) {
    const played = Math.min(now - s.item.firstAudioAt, s.item.bytes / BYTES_PER_MS);
    send.push({
      type: 'conversation.item.truncate',
      item_id: s.item.id,
      content_index: 0,
      audio_end_ms: Math.max(0, Math.floor(played)),
    });
    s.muted = true;
  }
  return { events: [{ type: 'barge_in' }], send };
}

function onResponseDone(s: ProtocolState, m: Msg): Step {
  const response = obj(m.response);
  const usage = obj(response.usage);
  s.responseActive = false;
  s.muted = false;
  s.item = null;
  const events: VoiceEvent[] = [{ type: 'reply_done' }];
  if (typeof usage.input_tokens === 'number' && typeof usage.output_tokens === 'number')
    events.push({
      type: 'usage',
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
    });
  if (response.status === 'failed')
    events.push({
      type: 'error',
      code: 'VOICE_UNAVAILABLE',
      message: 'The voice model failed to reply',
    });
  const next = s.queued.shift();
  if (next) s.responseActive = true;
  return { events, send: next ? [next] : [] };
}

function onFunctionArgs(s: ProtocolState, m: Msg): Step {
  const callId = str(m.call_id);
  const name = str(m.name) || s.functionNames.get(callId) || '';
  return {
    events: [{ type: 'tool_call', callId, name, argumentsJson: str(m.arguments) || '{}' }],
    send: [],
  };
}

function onItem(s: ProtocolState, m: Msg): Step {
  const item = obj(m.item);
  if (item.type === 'function_call') s.functionNames.set(str(item.call_id), str(item.name));
  return none();
}

function onError(m: Msg): Step {
  const error = obj(m.error);
  if (BENIGN_ERRORS.has(str(error.code))) return none();
  return {
    events: [{ type: 'error', code: 'VOICE_PROTOCOL', message: str(error.code) || 'error' }],
    send: [],
  };
}

const transcript = (role: 'AUTHOR' | 'ASSISTANT', text: string): Step =>
  text.trim() ? { events: [{ type: 'transcript', role, text: text.trim() }], send: [] } : none();

type Handler = (s: ProtocolState, m: Msg, now: number, config: { update: ClientEvent }) => Step;

/** The server events a call reacts to; every other event is ignored. */
const HANDLERS: Record<string, Handler> = {
  'session.created': (_s, _m, _now, config) => ({ events: [], send: [config.update] }),
  'session.updated': (s) => {
    s.ready = true;
    return none();
  },
  'response.created': (s) => {
    s.responseActive = true;
    return none();
  },
  'response.output_audio.delta': (s, m, now) => onAudioDelta(s, m, now),
  'response.output_audio_transcript.done': (_s, m) => transcript('ASSISTANT', str(m.transcript)),
  'conversation.item.input_audio_transcription.completed': (_s, m) =>
    transcript('AUTHOR', str(m.transcript)),
  'input_audio_buffer.speech_started': (s, _m, now) => onSpeechStarted(s, now),
  'conversation.item.added': (s, m) => onItem(s, m),
  'conversation.item.done': (s, m) => onItem(s, m),
  'response.function_call_arguments.done': (s, m) => onFunctionArgs(s, m),
  'response.done': (s, m) => onResponseDone(s, m),
  error: (_s, m) => onError(m),
};

/** One server event → domain events + client events to send. Unknown events are ignored. */
export function handleServerEvent(
  s: ProtocolState,
  m: Msg,
  now: number,
  config: { update: ClientEvent },
): Step {
  const handle = Object.hasOwn(HANDLERS, str(m.type)) ? HANDLERS[str(m.type)] : undefined;
  return handle ? handle(s, m, now, config) : none();
}
