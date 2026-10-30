import { describe, expect, it } from 'vitest';
import { keyFromLabel, labelFor, moved, optionsWith } from './categories';

const options = [
  { key: 'BILLING', label: 'Billing' },
  { key: 'GENERAL_INQUIRY', label: 'General Inquiry' },
];

describe('category helpers', () => {
  it('suggests an UPPER_SNAKE_CASE key from a label', () => {
    expect(keyFromLabel('Billing & Refunds')).toBe('BILLING_REFUNDS');
    expect(keyFromLabel('  2nd-line support ')).toBe('ND_LINE_SUPPORT');
    expect(keyFromLabel('x'.repeat(60))).toHaveLength(40);
  });

  it('moves one item up or down and leaves the ends alone', () => {
    expect(moved(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moved(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moved(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moved(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it("shows a category's label, or its key once it is no longer active", () => {
    expect(labelFor(options, 'BILLING')).toBe('Billing');
    expect(labelFor(options, 'OLD_ONE')).toBe('OLD_ONE');
    expect(labelFor(options, null)).toBe('');
  });

  it("keeps a ticket's deactivated category in its picker", () => {
    expect(optionsWith(options, 'OLD_ONE', 'Old one').map((o) => o.key)).toEqual([
      'BILLING',
      'GENERAL_INQUIRY',
      'OLD_ONE',
    ]);
    expect(optionsWith(options, 'BILLING', 'Billing')).toHaveLength(2);
    expect(optionsWith(undefined, null, null)).toEqual([]);
  });
});
