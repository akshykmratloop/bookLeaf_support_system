import type { TicketDraft } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { draftHasContent, shouldShowTicket } from './ticketVisibility';

const blank: TicketDraft = {
  id: '11111111-1111-4111-8111-111111111111',
  category: null,
  bookId: null,
  subject: '',
  description: '',
  status: 'OPEN',
  version: 0,
  lastEditedBy: 'ASSISTANT',
  isComplete: false,
  ticket: null,
  updatedAt: '2026-10-28T00:00:00.000Z',
};

describe('ticket box visibility', () => {
  it('hides the box when there is no draft or the draft is blank', () => {
    expect(shouldShowTicket(null, { opened: false })).toBe(false);
    expect(shouldShowTicket(blank, { opened: false })).toBe(false);
  });

  it('shows it as soon as any field is filled in', () => {
    expect(shouldShowTicket({ ...blank, subject: 'Royalty' }, { opened: false })).toBe(true);
    expect(shouldShowTicket({ ...blank, category: 'ROYALTY_PAYMENTS' }, { opened: false })).toBe(
      true,
    );
    expect(draftHasContent({ ...blank, description: '  ' })).toBe(false);
  });

  it('shows it while the assistant waits for a yes, and after the ticket was sent', () => {
    expect(shouldShowTicket({ ...blank, status: 'AWAITING_CONFIRMATION' }, { opened: false })).toBe(
      true,
    );
    const sent = {
      ...blank,
      status: 'SUBMITTED' as const,
      ticket: { id: blank.id, number: 'BL-1' },
    };
    expect(shouldShowTicket(sent, { opened: false })).toBe(true);
  });

  it('shows it when the author opened it with the Ticket button', () => {
    expect(shouldShowTicket(null, { opened: true })).toBe(true);
    expect(shouldShowTicket(blank, { opened: true })).toBe(true);
  });
});
