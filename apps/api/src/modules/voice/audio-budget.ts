import { VOICE_SAMPLE_RATE } from '@bookleaf/shared';

/** PCM16 mono: two bytes per sample. */
const REAL_TIME_BYTES_PER_SECOND = VOICE_SAMPLE_RATE * 2;
/** Slack over real time for clock drift between the browser and the server. */
const RATE_SLACK = 1.25;
/** Frames that bunch up after a network stall may arrive together. */
const BURST_SECONDS = 2;

/**
 * Token bucket over caller audio. A modified client cannot push more audio into the provider
 * than the call actually lasts, which keeps the 5-minute cap a real cost cap.
 * Returns `accept(bytes)`: true when the frame fits the budget.
 */
export function audioBudget(now: () => number = () => performance.now()) {
  const rate = REAL_TIME_BYTES_PER_SECOND * RATE_SLACK;
  const burst = REAL_TIME_BYTES_PER_SECOND * BURST_SECONDS;
  let tokens = burst;
  let last = now();
  return (bytes: number): boolean => {
    const t = now();
    tokens = Math.min(burst, tokens + ((t - last) / 1000) * rate);
    last = t;
    if (bytes > tokens) return false;
    tokens -= bytes;
    return true;
  };
}
