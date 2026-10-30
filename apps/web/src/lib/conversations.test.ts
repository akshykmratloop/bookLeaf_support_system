import { describe, expect, it } from 'vitest';
import { kindOf, outcomeOf } from './conversations';

const ID = '00000000-0000-4000-8000-000000000001';

describe('conversation helpers', () => {
  it('reads the kind back from the link segment', () => {
    expect(kindOf('chat')).toBe('CHAT');
    expect(kindOf('call')).toBe('CALL');
    expect(kindOf('tickets')).toBeNull();
  });

  it('names the outcome: a sent ticket, an unsent draft, or nothing', () => {
    const ticket = { id: ID, number: 'BL-1004' };
    expect(outcomeOf({ ticket, draftStatus: 'SUBMITTED' })?.label).toBe('Ticket BL-1004');
    expect(outcomeOf({ ticket: null, draftStatus: 'OPEN' })?.label).toBe('Ticket not sent');
    expect(outcomeOf({ ticket: null, draftStatus: null })).toBeNull();
  });
});
