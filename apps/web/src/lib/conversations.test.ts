import { describe, expect, it } from 'vitest';
import { conversationPath, kindOf, outcomeOf } from './conversations';

const ID = '00000000-0000-4000-8000-000000000001';

describe('conversation helpers', () => {
  it('builds a link for each kind and reads it back', () => {
    expect(conversationPath({ kind: 'CHAT', id: ID })).toBe(`/embed/history/chat/${ID}`);
    expect(conversationPath({ kind: 'CALL', id: ID })).toBe(`/embed/history/call/${ID}`);
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
