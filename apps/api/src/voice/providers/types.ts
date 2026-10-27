/**
 * The speech-to-speech capability, in BookLeaf's words. Core code (the call controller) depends
 * only on this file; each vendor adapter implements it over its own raw WebSocket protocol.
 * Checked against two vendors: OpenAI Realtime (24 kHz in) and Gemini Live (16 kHz in).
 */

/** A function the model may call during the call. Runs on the BookLeaf server, never in the browser. */
export interface VoiceTool {
  name: string;
  description: string;
  /** JSON Schema for the arguments (type "object"). */
  parameters: Record<string, unknown>;
}

export interface VoiceSessionConfig {
  instructions: string;
  tools: VoiceTool[];
  /** Spoken language for transcription (ISO 639-1), e.g. "en". */
  language: string;
  /** The assistant's first words, spoken exactly as written. */
  greeting: string;
}

export type VoiceErrorCode = 'VOICE_UNAVAILABLE' | 'VOICE_AUTH' | 'VOICE_PROTOCOL';

export type VoiceEvent =
  /** Assistant audio: PCM16 little-endian mono at the provider's output rate. */
  | { type: 'audio'; pcm16: Buffer }
  /** A finished line of speech, as text. */
  | { type: 'transcript'; role: 'AUTHOR' | 'ASSISTANT'; text: string }
  /** The caller started talking over the assistant: stop playing its queued audio. */
  | { type: 'barge_in' }
  | { type: 'tool_call'; callId: string; name: string; argumentsJson: string }
  /** The assistant finished one reply (spoken audio fully sent). */
  | { type: 'reply_done' }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'error'; code: VoiceErrorCode; message: string }
  | { type: 'closed' };

/** A live, connected session. Methods never throw; failures arrive as `error` events. */
export interface VoiceSession {
  /** Caller audio: PCM16 little-endian mono at the provider's input rate. */
  sendAudio(pcm16: Buffer): void;
  sendToolResult(callId: string, result: Record<string, unknown>): void;
  /** Ask the assistant to say this line now (for example the time warning). */
  say(text: string): void;
  /** Start the conversation with a short greeting. */
  greet(): void;
  close(): void;
}

export interface VoiceProvider {
  readonly id: string;
  readonly model: string;
  readonly inputSampleRate: number;
  readonly outputSampleRate: number;
  /** Resolves once the vendor session is configured and ready for audio. */
  connect(config: VoiceSessionConfig, onEvent: (e: VoiceEvent) => void): Promise<VoiceSession>;
}

/** Thrown only by `connect`; mid-call problems arrive as `error` events. */
export class VoiceProviderError extends Error {
  constructor(
    readonly code: VoiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'VoiceProviderError';
  }
}
