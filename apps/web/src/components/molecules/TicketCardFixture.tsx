import type { AuthorTicketListItem } from '@bookleaf/shared';
import { TicketCard } from './TicketCard';

const SAMPLE: AuthorTicketListItem = {
  id: '00000000-0000-4000-8000-000000000001',
  number: 'BL-1001',
  subject: 'When will my royalty be paid?',
  status: 'IN_PROGRESS',
  category: 'ROYALTY_PAYMENTS',
  categoryLabel: 'Royalty & Payments',
  channel: 'CHAT',
  lastActivity: {
    from: 'TEAM',
    at: '2026-10-27T10:00:00.000Z',
    preview: 'Thank you for your patience. We are checking your statement.',
  },
  awaitingYou: true,
  canSolve: true,
  canReply: true,
  book: { id: '00000000-0000-4000-8000-0000000000b1', title: 'Whispers of the Ganges' },
  createdAt: '2026-10-26T10:00:00.000Z',
  updatedAt: '2026-10-27T10:00:00.000Z',
  replyCount: 1,
};

/** Example cards the boneyard CLI measures to capture the list's loading shape. */
export function TicketCardFixture() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {[1, 2, 3, 4].map((n) => (
        <TicketCard key={n} ticket={{ ...SAMPLE, id: `${SAMPLE.id.slice(0, -1)}${n}` }} />
      ))}
    </div>
  );
}
