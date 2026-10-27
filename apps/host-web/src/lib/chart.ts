/** Clean axis maximum: the next 1 / 2 / 2.5 / 5 × 10ⁿ at or above the largest value. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
}

/** Evenly spaced ticks from 0 to max. */
export const ticks = (max: number, count = 4) =>
  Array.from({ length: count + 1 }, (_, i) => (max / count) * i);

/** A value's share of the scale, as a percentage width (never negative, never over 100). */
export const pct = (value: number, max: number) =>
  max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));

/** Stroke dash for a progress ring of the given radius at `percent` (0–100). */
export function ringDash(radius: number, percent: number) {
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  return { dasharray: `${filled} ${circumference}`, circumference };
}
