import { describe, expect, it } from 'vitest';
import { authorPathsFor, legacyAuthorPath } from './paths';

const ID = '00000000-0000-4000-8000-000000000001';

describe("a workspace's author app lives at /embed/<slug> (F-18)", () => {
  it('builds every page of the app under the workspace address', () => {
    const p = authorPathsFor('acme');
    expect(p.home).toBe('/embed/acme');
    expect(p.ask).toBe('/embed/acme/ask');
    expect(p.tickets).toBe('/embed/acme/tickets');
    expect(p.newTicket).toBe('/embed/acme/tickets/new');
    expect(p.ticket(ID)).toBe(`/embed/acme/tickets/${ID}`);
    expect(p.history).toBe('/embed/acme/history');
    expect(p.conversation('CHAT', ID)).toBe(`/embed/acme/history/chat/${ID}`);
    expect(p.conversation('CALL', ID)).toBe(`/embed/acme/history/call/${ID}`);
  });

  it('sends the old shared addresses to the default workspace (BookLeaf)', () => {
    expect(legacyAuthorPath('/embed')).toBe('/embed/bookleaf');
    expect(legacyAuthorPath('/embed/tickets/7')).toBe('/embed/bookleaf/tickets/7');
    expect(legacyAuthorPath('/embed/history/chat/x')).toBe('/embed/bookleaf/history/chat/x');
  });
});
