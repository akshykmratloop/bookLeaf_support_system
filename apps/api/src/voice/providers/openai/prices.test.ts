import { describe, expect, it } from 'vitest';
import { NO_VOICE_USAGE } from '../usage.js';
import { realtimeCostMicros } from './prices.js';
import { openAiVoiceProvider } from './provider.js';

const MILLION = 1_000_000;
const only = (field: keyof typeof NO_VOICE_USAGE) => ({ ...NO_VOICE_USAGE, [field]: MILLION });

describe('OpenAI Realtime prices (USD per million tokens, OpenAI pricing page)', () => {
  it('prices gpt-realtime-2.1 text and audio, cached and not, separately', () => {
    const m = 'gpt-realtime-2.1';
    expect(realtimeCostMicros(m, only('textIn'))).toBe(4 * MILLION);
    expect(realtimeCostMicros(m, only('cachedTextIn'))).toBe(0.4 * MILLION);
    expect(realtimeCostMicros(m, only('textOut'))).toBe(24 * MILLION);
    expect(realtimeCostMicros(m, only('audioIn'))).toBe(32 * MILLION);
    expect(realtimeCostMicros(m, only('cachedAudioIn'))).toBe(0.4 * MILLION);
    expect(realtimeCostMicros(m, only('audioOut'))).toBe(64 * MILLION);
  });

  it('prices gpt-realtime-2.1-mini at its own rates', () => {
    const m = 'gpt-realtime-2.1-mini';
    expect(realtimeCostMicros(m, only('textIn'))).toBe(0.6 * MILLION);
    expect(realtimeCostMicros(m, only('textOut'))).toBe(2.4 * MILLION);
    expect(realtimeCostMicros(m, only('audioIn'))).toBe(10 * MILLION);
    expect(realtimeCostMicros(m, only('cachedAudioIn'))).toBe(0.3 * MILLION);
    expect(realtimeCostMicros(m, only('cachedTextIn'))).toBe(0.06 * MILLION);
    expect(realtimeCostMicros(m, only('audioOut'))).toBe(20 * MILLION);
  });

  it('a short call: cached audio is far cheaper than fresh audio', () => {
    const call = {
      textIn: 2_000,
      audioIn: 1_500,
      cachedTextIn: 6_000,
      cachedAudioIn: 1_000,
      textOut: 300,
      audioOut: 2_500,
    };
    // 2000×4 + 1500×32 + 6000×0.4 + 1000×0.4 + 300×24 + 2500×64 micro-dollars.
    expect(realtimeCostMicros('gpt-realtime-2.1', call)).toBe(
      8_000 + 48_000 + 2_400 + 400 + 7_200 + 160_000,
    );
  });

  it('has no price for a model it does not know', () => {
    expect(realtimeCostMicros('gpt-realtime-unknown', only('audioIn'))).toBeNull();
  });

  it('the provider prices calls on its own model', () => {
    const p = openAiVoiceProvider({ apiKey: 'k', model: 'gpt-realtime-2.1', voice: 'marin' });
    expect(p.costMicros(only('audioOut'))).toBe(64 * MILLION);
  });
});
