import type { VoiceEvent, VoiceSessionConfig } from '../types.js';
import { OPENAI_VOICES } from './voices.js';

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

/** The workspace's voice when OpenAI has it, else the configured default. */
const voiceFor = (config: VoiceSessionConfig, fallback: string) =>
  config.voice && OPENAI_VOICES.includes(config.voice) ? config.voice : fallback;

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
          transcription: {
            model: 'gpt-realtime-whisper',
            ...(config.language ? { language: config.language } : {}),
          },
        },
        output: { voice: voiceFor(config, voice), format: { type: 'audio/pcm', rate: 24_000 } },
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

export { handleServerEvent } from './server-events.js';
