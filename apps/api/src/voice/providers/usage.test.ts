import { describe, expect, it } from 'vitest';
import { addVoiceUsage, NO_VOICE_USAGE, voiceUsageTotals, type VoiceUsage } from './usage.js';

const reply = (u: Partial<VoiceUsage>): VoiceUsage => ({ ...NO_VOICE_USAGE, ...u });

describe('voice usage (domain)', () => {
  it('adds two replies field by field without changing either', () => {
    const a = reply({ textIn: 10, audioIn: 100, cachedAudioIn: 50, audioOut: 200 });
    const b = reply({ textIn: 5, cachedTextIn: 7, textOut: 3, audioOut: 20 });
    expect(addVoiceUsage(a, b)).toEqual({
      textIn: 15,
      audioIn: 100,
      cachedTextIn: 7,
      cachedAudioIn: 50,
      textOut: 3,
      audioOut: 220,
    });
    expect(a.textIn).toBe(10);
  });

  it('totals: all input (cached included), the cached part, and all output', () => {
    const u = reply({ textIn: 10, audioIn: 100, cachedTextIn: 7, cachedAudioIn: 50 });
    expect(voiceUsageTotals({ ...u, textOut: 3, audioOut: 220 })).toEqual({
      inputTokens: 167,
      cachedInputTokens: 57,
      outputTokens: 223,
    });
    expect(voiceUsageTotals(NO_VOICE_USAGE)).toEqual({
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
    });
  });
});
