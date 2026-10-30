import { CheckCircle2, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '../atoms/Card';
import { useAuthorPaths } from '../../lib/paths';

/**
 * Shown instead of the reply box once a ticket is solved or closed (U-2): it no longer takes
 * replies, so the author is pointed to a new ticket. Only the support team can reopen it.
 */
export function TicketSolvedNote({ closed }: { closed: boolean }) {
  const paths = useAuthorPaths();
  return (
    <Card variant="flat" className="flex flex-col gap-3 p-4" role="status">
      <p className="flex items-center gap-2 text-[14px] font-bold">
        <CheckCircle2 size={17} aria-hidden className="shrink-0 text-success" />
        {closed ? 'This ticket is closed' : 'This ticket is solved'}
      </p>
      <p className="text-[12.5px] text-ink-2">
        It no longer takes replies. Still need help, or have a new question? Raise a new ticket and
        the team will pick it up.
      </p>
      <Link
        to={paths.newTicket}
        className="inline-flex h-9 w-fit items-center gap-2 rounded-control bg-brand px-4 text-[13px] font-semibold text-white shadow-soft hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
      >
        <Plus size={14} aria-hidden /> Raise a new ticket
      </Link>
    </Card>
  );
}
