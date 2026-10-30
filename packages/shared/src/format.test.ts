import { describe, expect, it } from 'vitest';
import { ticketNumberLabel } from './format.js';

describe('ticketNumberLabel', () => {
  it("joins the workspace's prefix and the stored number (no offset)", () => {
    expect(ticketNumberLabel('BL', 1001)).toBe('BL-1001');
    expect(ticketNumberLabel('AC2', 1042)).toBe('AC2-1042');
  });
});
