import type { VoiceEvent, VoiceSessionConfig } from '../types.js';

/**
 * OpenAI Realtime wire protocol (GA event names), as pure functions: server JSON in, domain
 * events and client JSON out. No socket here, so every rule is unit-tested.
 */

export type ClientEvent = Record<string, unknown> & { type: string };

export interface ProtocolState {
  ready: boolean;
  /** A reply is being generated; a second response.create would be rejected. */
  responseActive: boolean;
  /** Replies we asked for while one was active, sent in order after response.done. */
  queued: ClientEvent[];
  /** After the caller interrupts, late audio of that reply is dropped until response.done. */
  muted: boolean;
  functionNames: Map<string, string>;
  item: { id: string; firstAudioAt: number; bytes: number } | null;
}

export interface Step {
  events: VoiceEvent[];
  send: ClientEvent[];
}

const BENIGN_ERRORS = new Set([
  'response_cancel_not_active',
  'conversation_already_has_active_response',
]);
const BYTES_PER_MS = (24_000 * 2) / 1000;

export const SAY_LINE = (text: string) =>
  `Say exactly the following words, in your normal voice, and nothing else. Do not add a greeting, a question or any other words: ${text}`;

/** A note for the model that is not part of the spoken conversation (no reply is requested). */
export const contextItem = (text: string): ClientEvent => ({
  type: 'conversation.item.create',
  item: { type: 'message', role: 'system', content: [{ type: 'input_text', text }] },
});

export function initialState(): ProtocolState {
  return {
    ready: false,
    responseActive: false,
    queued: [],
    muted: false,
    functionNames: new Map(),
    item: null,
  };
}

export function sessionUpdate(config: VoiceSessionConfig, voice: string): ClientEvent {
  return {
    type: 'session.update',
    session: {
      type: 'realtime',
      instructions: config.instructions,
      output_modalities: ['audio'],
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24_000 },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
            create_response: true,
            interrupt_response: true,
          },
          noise_reduction: { type: 'near_field' },
          transcription: { model: 'gpt-realtime-whisper', language: config.language },
        },
        output: { voice, format: { type: 'audio/pcm', rate: 24_000 } },
      },
      tools: config.tools.map((t) => ({ type: 'function', ...t })),
      tool_choice: 'auto',
    },
  };
}

/** Ask for a reply now, or queue it if one is already being generated. */
export function requestReply(state: ProtocolState, instructions?: string): ClientEvent[] {
  const event: ClientEvent = {
    type: 'response.create',
    ...(instructions ? { response: { output_modalities: ['audio'], instructions } } : {}),
  };
  if (state.responseActive) {
    state.queued.push(event);
    return [];
  }
  state.responseActive = true;
  return [event];
}

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

/** One server event → domain events + client events to send. Unknown events are ignored. */
export function handleServerEvent(
  s: ProtocolState,
  m: Msg,
  now: number,
  config: { update: ClientEvent },
): Step {
  switch (str(m.type)) {
    case 'session.created':
      return { events: [], send: [config.update] };
    case 'session.updated':
      s.ready = true;
      return none();
    case 'response.created':
      s.responseActive = true;
      return none();
    case 'response.output_audio.delta':
      return onAudioDelta(s, m, now);
    case 'response.output_audio_transcript.done':
      return transcript('ASSISTANT', str(m.transcript));
    case 'conversation.item.input_audio_transcription.completed':
      return transcript('AUTHOR', str(m.transcript));
    case 'input_audio_buffer.speech_started':
      return onSpeechStarted(s, now);
    case 'conversation.item.added':
    case 'conversation.item.done':
      return onItem(s, m);
    case 'response.function_call_arguments.done':
      return onFunctionArgs(s, m);
    case 'response.done':
      return onResponseDone(s, m);
    case 'error':
      return onError(m);
    default:
      return none();
  }
}
