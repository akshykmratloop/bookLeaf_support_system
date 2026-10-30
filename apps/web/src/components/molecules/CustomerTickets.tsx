import type { CustomerTicket } from '@bookleaf/shared';
import { Link } from 'react-router';
import { day } from '../../lib/format';
import { moreTicketsText } from '../../lib/ticketCustomer';
import { StatusPill } from './DomainPills';

/** The customer's other tickets in this workspace, newest first, each a link to its page. */
export function CustomerTickets({
  tickets,
  total,
}: {
  tickets: readonly CustomerTicket[];
  total: number;
}) {
  if (!tickets.length)
    return <p className="text-[12.5px] text-ink-3">No other tickets from this customer.</p>;
  const more = moreTicketsText(tickets.length, total);
  return (
    <>
      <ul className="-mx-2 flex flex-col">
        {tickets.map((t) => (
          <li key={t.id}>
            <Link
              to={`/admin/tickets/${t.id}`}
              className="flex min-w-0 items-start gap-2 rounded-control px-2 py-1.5 hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[11.5px] text-ink-3">
                  {t.number} · {day(t.createdAt)}
                </span>
                <span className="block truncate text-[12.5px] font-medium text-ink">
                  {t.subject}
                </span>
              </span>
              <span className="shrink-0">
                <StatusPill status={t.status} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {more ? <p className="text-[11.5px] text-ink-3">{more}</p> : null}
    </>
  );
}
