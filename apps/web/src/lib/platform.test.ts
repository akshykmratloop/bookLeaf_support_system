import { describe, expect, it } from 'vitest';
import { formatCost } from './platform';

describe('formatCost (U-7 usage)', () => {
  it('shows micro-dollars as dollars, with tiny amounts kept visible', () => {
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(1_500)).toBe('<$0.01');
    expect(formatCost(420_000)).toBe('$0.42');
    expect(formatCost(1_234_560_000)).toBe('$1,234.56');
  });
});
