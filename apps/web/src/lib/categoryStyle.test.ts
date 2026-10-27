import { TICKET_CATEGORIES, TICKET_SOURCES } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { initialsOf } from '../components/atoms/Avatar';
import { categoryStyle, channelStyle } from './categoryStyle';

describe('categoryStyle', () => {
  it('gives every issue type its own colour and a label', () => {
    const colours = TICKET_CATEGORIES.map((c) => categoryStyle(c).colors);
    expect(new Set(colours).size).toBe(TICKET_CATEGORIES.length);
    for (const c of TICKET_CATEGORIES) expect(categoryStyle(c).label).not.toBe('');
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
