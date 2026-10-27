import { describe, expect, it } from 'vitest';
import { audioBudget } from './audio-budget.js';

/** 40 ms of 24 kHz PCM16, the size the browser worklet sends. */
const FRAME = 1920;

describe('audioBudget', () => {
  it('accepts a real-time stream indefinitely', () => {
    let t = 0;
    const accept = audioBudget(() => t);
    let dropped = 0;
    for (let i = 0; i < 25 * 300; i += 1) {
      t += 40;
      if (!accept(FRAME)) dropped += 1;
    }
    expect(dropped).toBe(0);
  });

  it('absorbs a short burst after a network stall', () => {
    let t = 0;
    const accept = audioBudget(() => t);
    t += 1000;
    const results = Array.from({ length: 25 }, () => accept(FRAME));
    expect(results.every(Boolean)).toBe(true);
  });

  it('drops audio pushed faster than real time once the burst is spent', () => {
    let t = 0;
    const accept = audioBudget(() => t);
    let accepted = 0;
    for (let i = 0; i < 1000; i += 1) {
      t += 1;
      if (accept(FRAME)) accepted += 1;
    }
    // One second of wall time: at most the 2 s burst plus ~1.25 s of refill gets through.
    expect(accepted * FRAME).toBeLessThan(48_000 * 3.5);
    expect(accepted).toBeLessThan(1000);
  });
});
