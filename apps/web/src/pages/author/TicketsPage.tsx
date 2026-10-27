import { MessageSquare, PlusCircle } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '../../components/atoms/Card';
import { StatusPill } from '../../components/molecules/DomainPills';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { errorMessage } from '../../lib/api';
import { relative } from '../../lib/format';
import { useAuthorTickets } from '../../lib/queries';

const newTicketLink = (
  <Link
    to="/tickets/new"
    className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-brand-strong px-4 text-[12.5px] font-semibold text-white hover:bg-brand"
  >
    <PlusCircle size={15} aria-hidden /> New ticket
  </Link>
);

export function TicketsPage() {
  const tickets = useAuthorTickets();
  const items = tickets.data?.items ?? [];
  return (
    <>
      <PageHeader
        title="My Tickets"
        subtitle="Replies from our team appear here automatically."
        actions={newTicketLink}
      />
      {tickets.isPending ? <LoadingState label="Loading your tickets…" /> : null}
      {tickets.isError ? (
        <ErrorState message={errorMessage(tickets.error)} onRetry={() => void tickets.refetch()} />
      ) : null}
      {tickets.data && items.length === 0 ? (
        <Card>
          <EmptyState
            title="No tickets yet"
            body="Have a question about royalties, your book's status, ISBN or printing? Raise a ticket and we'll reply here."
            action={newTicketLink}
          />
        </Card>
      ) : null}
      {items.length > 0 ? (
        <Card>
          <ul className="divide-y divide-line">
            {items.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/tickets/${t.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-panel-2"
                >
                  <span className="font-mono text-[12px] text-ink-3">{t.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.subject}</span>
                    <span className="block text-[12px] text-ink-3">
                      {t.book?.title ?? 'General / Account level'} · opened {relative(t.createdAt)}
                    </span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[12px] text-ink-2"
                    title="Replies from BookLeaf"
                  >
                    <MessageSquare size={14} aria-hidden /> {t.replyCount}
                  </span>
                  <StatusPill status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
