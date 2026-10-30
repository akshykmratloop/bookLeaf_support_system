import type { Draft, TicketMessage } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { isDraftAnswered } from './replyDraft';

const draft = { id: 'd1', createdAt: '2026-10-30T10:00:00.000Z' } as Pick<
  Draft,
  'id' | 'createdAt'
>;
const message = (kind: TicketMessage['kind'], createdAt: string): TicketMessage => ({
  id: `${kind}-${createdAt}`,
  kind,
  body: 'text',
  senderName: null,
  createdAt,
});

describe('isDraftAnswered', () => {
  it('is false when there is no draft', () => {
    expect(isDraftAnswered(null, [message('REPLY', '2026-10-30T11:00:00.000Z')])).toBe(false);
  });

  it('is false while no reply was sent after the draft was written', () => {
    expect(isDraftAnswered(draft, [message('REPLY', '2026-10-30T09:00:00.000Z')])).toBe(false);
  });

  it('is true once a reply to the author was sent after the draft', () => {
    expect(isDraftAnswered(draft, [message('REPLY', '2026-10-30T10:05:00.000Z')])).toBe(true);
  });

  it('ignores internal notes, author messages and system lines', () => {
    const later = '2026-10-30T10:05:00.000Z';
    const others = [
      message('INTERNAL_NOTE', later),
      message('AUTHOR', later),
      message('SYSTEM', later),
    ];
    expect(isDraftAnswered(draft, others)).toBe(false);
  });
});
