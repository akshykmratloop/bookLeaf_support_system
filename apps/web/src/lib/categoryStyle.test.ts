import { LEGACY_TICKET_CATEGORIES, TICKET_SOURCES } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { initialsOf } from '../components/atoms/Avatar';
import { categoryStyle, channelStyle } from './categoryStyle';

describe('categoryStyle', () => {
  it("gives each of BookLeaf's categories its own colour, and shows the workspace's label", () => {
    const colours = LEGACY_TICKET_CATEGORIES.map((c) => categoryStyle(c).colors);
    expect(new Set(colours).size).toBe(LEGACY_TICKET_CATEGORIES.length);
    expect(categoryStyle('ROYALTY_PAYMENTS', 'Royalty & Payments').label).toBe(
      'Royalty & Payments',
    );
  });

  it("gives another workspace's category a stable colour and falls back to its key", () => {
    expect(categoryStyle('BILLING').colors).toBe(categoryStyle('BILLING', 'Billing').colors);
    expect(categoryStyle('BILLING')).toMatchObject({ label: 'BILLING' });
    expect(categoryStyle('BILLING', 'Billing').label).toBe('Billing');
  });

  it('shows a ticket that is not sorted yet as general', () => {
    expect(categoryStyle(null)).toMatchObject({
      label: 'Not sorted yet',
      colors: categoryStyle('GENERAL_INQUIRY').colors,
    });
  });

  it('names every channel', () => {
    expect(TICKET_SOURCES.map((s) => channelStyle(s).label)).toEqual([
      'Ticket form',
      'Chat',
      'Call',
      'Your server (API)',
    ]);
  });
});

describe('initialsOf', () => {
  it('takes the first letters of up to two names', () => {
    expect(initialsOf('Priya Sharma')).toBe('PS');
    expect(initialsOf('  kavita  ')).toBe('K');
    expect(initialsOf('Arjun Dev Malhotra')).toBe('AD');
  });
});
