import { describe, expect, it } from 'vitest';
import { niceMax, pct, ringDash, ticks } from './chart';

describe('chart maths', () => {
  it('rounds the axis up to a clean number', () => {
    expect(niceMax(11970)).toBe(20000);
    expect(niceMax(342)).toBe(500);
    expect(niceMax(250)).toBe(250);
    expect(niceMax(0)).toBe(1);
  });

  it('spaces ticks evenly from zero', () => {
    expect(ticks(20000)).toEqual([0, 5000, 10000, 15000, 20000]);
  });

  it('keeps widths between 0 and 100 %', () => {
    expect(pct(50, 200)).toBe(25);
    expect(pct(500, 200)).toBe(100);
    expect(pct(-5, 200)).toBe(0);
    expect(pct(5, 0)).toBe(0);
  });

  it('fills the ring in proportion, clamped', () => {
    const half = ringDash(10, 50);
    expect(Number(half.dasharray.split(' ')[0])).toBeCloseTo(Math.PI * 10);
    expect(ringDash(10, 140).dasharray.split(' ')[0]).toBe(String(2 * Math.PI * 10));
  });
});
