import type { TicketDraft } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { authorEditNote } from './draft-sync.js';

const draft = (patch: Partial<TicketDraft> = {}) =>
  ({
    id: 'd1',
    category: null,
    bookId: null,
    subject: '',
    description: '',
    status: 'OPEN',
    ticket: null,
    ...patch,
  }) as TicketDraft;

describe('authorEditNote', () => {
  it('tells the model the author discarded the draft, and that an earlier yes no longer counts', () => {
    const note = authorEditNote(
      { draft: draft(), by: 'AUTHOR', changed: ['subject'], discarded: true },
      'AWAITING_CONFIRMATION',
    );
    expect(note).toContain('discarded the ticket draft');
    expect(note).toContain('no longer counts');
  });

  it('quotes the fields the author edited', () => {
    const note = authorEditNote(
      { draft: draft({ subject: 'New subject' }), by: 'AUTHOR', changed: ['subject'] },
      'OPEN',
    );
    expect(note).toContain('subject: "New subject"');
  });
});
