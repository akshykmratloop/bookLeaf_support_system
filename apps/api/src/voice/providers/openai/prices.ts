import type { VoiceUsage } from '../usage.js';

/** USD per million tokens for one Realtime model (1 USD per million = 1 micro-dollar per token). */
type RealtimePrice = Record<keyof VoiceUsage, number>;

/**
 * OpenAI's published Realtime prices (https://developers.openai.com/api/docs/pricing), checked
 * 2026-11-02. A model missing here has no price: its calls are logged without a cost.
 */
const REALTIME_PRICES: Readonly<Record<string, RealtimePrice>> = {
  'gpt-realtime-2.1': {
    textIn: 4,
    cachedTextIn: 0.4,
    textOut: 24,
    audioIn: 32,
    cachedAudioIn: 0.4,
    audioOut: 64,
  },
  'gpt-realtime-2.1-mini': {
    textIn: 0.6,
    cachedTextIn: 0.06,
    textOut: 2.4,
    audioIn: 10,
    cachedAudioIn: 0.3,
    audioOut: 20,
  },
  'gpt-realtime': {
    textIn: 4,
    cachedTextIn: 0.4,
    textOut: 16,
    audioIn: 32,
    cachedAudioIn: 0.4,
    audioOut: 64,
  },
  'gpt-realtime-mini': {
    textIn: 0.6,
    cachedTextIn: 0.06,
    textOut: 2.4,
    audioIn: 10,
    cachedAudioIn: 0.3,
    audioOut: 20,
  },
};

/** The cost of the tokens given, in whole micro-dollars; null for a model without a price. */
export function realtimeCostMicros(model: string, usage: VoiceUsage): number | null {
  const price = Object.hasOwn(REALTIME_PRICES, model) ? REALTIME_PRICES[model] : undefined;
  if (!price) return null;
  const fields = Object.keys(price) as (keyof VoiceUsage)[];
  return Math.round(fields.reduce((sum, f) => sum + usage[f] * price[f], 0));
}
