import { describe, expect, it } from 'vitest';
import { estimateCostMicros, findModel } from './catalog.js';

const usage = (u: Partial<Parameters<typeof estimateCostMicros>[1]>) => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  ...u,
});
const MILLION = 1_000_000;

describe('estimateCostMicros (Anthropic published prices, USD per million tokens)', () => {
  it('prices each model’s input, cache write, cache read and output separately', () => {
    // A million tokens at $X per million = X dollars = X × 1,000,000 micro-dollars.
    const sonnet = findModel('anthropic', 'claude-sonnet-5-5');
    expect(estimateCostMicros(sonnet, usage({ inputTokens: MILLION }))).toBe(2 * MILLION);
    expect(estimateCostMicros(sonnet, usage({ cacheWriteTokens: MILLION }))).toBe(2.5 * MILLION);
    expect(estimateCostMicros(sonnet, usage({ outputTokens: MILLION }))).toBe(10 * MILLION);
  });

  it('charges Sonnet cache reads at $0.10 per million (0.05× input, not 0.1×)', () => {
    const sonnet = findModel('anthropic', 'claude-sonnet-5-5');
    expect(estimateCostMicros(sonnet, usage({ cacheReadTokens: MILLION }))).toBe(100_000);
  });

  it('prices Haiku and Opus at their own rates', () => {
    const haiku = findModel('anthropic', 'claude-haiku-5-5');
    const opus = findModel('anthropic', 'claude-opus-5-5');
    expect(haiku).toMatchObject({ cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.125 });
    expect(opus).toMatchObject({ cacheReadPerMTok: 0.2, cacheWritePerMTok: 5 });
    // A typical triage call: 1,500 fresh input, 4,000 cached, 120 output tokens on Haiku.
    const triage = usage({ inputTokens: 1_500, cacheReadTokens: 4_000, outputTokens: 120 });
    expect(estimateCostMicros(haiku, triage)).toBe(150 + 40 + 60);
  });

  it('rounds to whole micro-dollars and has no price for an unknown model', () => {
    const haiku = findModel('anthropic', 'claude-haiku-5-5');
    expect(estimateCostMicros(haiku, usage({ inputTokens: 3 }))).toBe(0);
    expect(estimateCostMicros(haiku, usage({ outputTokens: 3 }))).toBe(2);
    expect(estimateCostMicros(findModel('anthropic', 'nope'), usage({ inputTokens: 9 }))).toBe(
      null,
    );
  });
});
