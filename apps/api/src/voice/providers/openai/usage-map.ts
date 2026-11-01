import type { VoiceUsage } from '../usage.js';

type Msg = Record<string, unknown>;
const obj = (v: unknown): Msg => (v && typeof v === 'object' ? (v as Msg) : {});
const count = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

/** Splits a total into text and audio; tokens the report does not place count as audio. */
function split(total: number, details: Msg) {
  const text = Math.min(total, count(details.text_tokens) ?? 0);
  const audio = count(details.audio_tokens) ?? total - text;
  return { text, audio };
}

/**
 * `response.done` → `response.usage` as domain usage, or null when the reply reported none.
 * OpenAI's text and audio input counts include the cached tokens, so those are taken out to get
 * the fresh input. Unplaced tokens count as audio (the dearer rate), never as free.
 */
export function toVoiceUsage(raw: unknown): VoiceUsage | null {
  const usage = obj(raw);
  const inputTotal = count(usage.input_tokens);
  const outputTotal = count(usage.output_tokens);
  if (inputTotal === null || outputTotal === null) return null;
  const inDetails = obj(usage.input_token_details);
  const input = split(inputTotal, inDetails);
  const cachedTotal = Math.min(inputTotal, count(inDetails.cached_tokens) ?? 0);
  const cached = split(cachedTotal, obj(inDetails.cached_tokens_details));
  const output = split(outputTotal, obj(usage.output_token_details));
  return {
    textIn: Math.max(0, input.text - cached.text),
    audioIn: Math.max(0, input.audio - cached.audio),
    cachedTextIn: cached.text,
    cachedAudioIn: cached.audio,
    textOut: output.text,
    audioOut: output.audio,
  };
}
