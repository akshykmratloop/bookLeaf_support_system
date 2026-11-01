import { describe, expect, it } from 'vitest';
import { OPENAI_VOICES } from './openai/voices.js';
import { voiceSamplesFor } from './registry.js';

describe('voiceSamplesFor', () => {
  it('gives a static sample path for every OpenAI voice', () => {
    const samples = voiceSamplesFor('openai', OPENAI_VOICES);
    expect(Object.keys(samples)).toEqual([...OPENAI_VOICES]);
    expect(samples.marin).toBe('/voice-samples/openai/marin.mp3');
  });

  it('leaves out voices without a sample, and unknown providers', () => {
    expect(voiceSamplesFor('openai', ['marin', 'not-a-voice'])).toEqual({
      marin: '/voice-samples/openai/marin.mp3',
    });
    expect(voiceSamplesFor('acme-voice', ['marin'])).toEqual({});
  });
});
