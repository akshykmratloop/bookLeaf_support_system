import { describe, expect, it } from 'vitest';
import { formatCredits, formatUnits, formatUsd } from './aiUsage';

describe('formatUsd (micro-dollars)', () => {
  it('shows small costs with up to four decimals', () => {
    expect(formatUsd(100)).toBe('$0.0001');
    expect(formatUsd(94_900)).toBe('$0.0949');
    expect(formatUsd(300_000)).toBe('$0.30');
  });

  it('shows a dollar or more with two decimals and grouping', () => {
    expect(formatUsd(1_234_567)).toBe('$1.23');
    expect(formatUsd(12_345_678_900)).toBe('$12,345.68');
  });

  it('zero is $0.00, and a cost below $0.0001 is not shown as free', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(40)).toBe('<$0.0001');
  });
});

describe('formatCredits', () => {
  it('up to two decimals, singular for exactly one', () => {
    expect(formatCredits(94.9)).toBe('94.9 credits');
    expect(formatCredits(1)).toBe('1 credit');
    expect(formatCredits(0)).toBe('0 credits');
    expect(formatCredits(12_345.67)).toBe('12,345.67 credits');
  });
});

describe('formatUnits', () => {
  it('names each feature’s unit, with call minutes to one decimal', () => {
    expect(formatUnits('ticket', 1)).toBe('1 ticket');
    expect(formatUnits('ticket', 2)).toBe('2 tickets');
    expect(formatUnits('draft', 3)).toBe('3 drafts');
    expect(formatUnits('reply', 1)).toBe('1 reply');
    expect(formatUnits('reply', 4)).toBe('4 replies');
    expect(formatUnits('minute', 1.5)).toBe('1.5 min');
  });
});
