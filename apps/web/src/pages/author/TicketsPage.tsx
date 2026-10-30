import { PlusCircle, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Card } from '../../components/atoms/Card';
import { Skeleton } from '../../components/atoms/Skeleton';
import { Tabs } from '../../components/atoms/Tabs';
import { EmptyState, ErrorState } from '../../components/molecules/States';
import { TicketCard } from '../../components/molecules/TicketCard';
import { TicketCardFixture } from '../../components/molecules/TicketCardFixture';
import { useAuthorPaths } from '../../lib/paths';
import { useAuthorTickets } from '../../lib/queries';
import {
  countByTab,
  filterTickets,
  TAB_LABELS,
  TICKET_TABS,
  type TicketTab,
} from '../../lib/ticketFilters';

function NewTicketLink() {
  const authorPaths = useAuthorPaths();
  return (
    <Link
      to={authorPaths.newTicket}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[13px] font-semibold text-white shadow-soft hover:bg-brand-strong"
    >
      <PlusCircle size={16} aria-hidden /> New ticket
    </Link>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-panel px-3.5 shadow-soft focus-within:border-brand/60 focus-within:ring-4 focus-within:ring-brand/15 sm:max-w-[280px]">
      <Search size={15} aria-hidden className="text-ink-3" />
      <span className="sr-only">Search your tickets</span>
      <input
        type="search"
        name="q"
        value={value}
        maxLength={100}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search tickets"
        className="min-w-0 flex-1 bg-transparent text-[13.5px] placeholder:text-ink-3 focus:outline-none"
      />
    </label>
  );
}

const EMPTY_TEXT: Record<TicketTab, string> = {
  ALL: "Have a question about royalties, your book's status, ISBN or printing? Raise a ticket and the team replies here.",
  AWAITING: 'Nothing is waiting for you. The team will let you know here when they need you.',
  OPEN: 'No open tickets right now.',
  SOLVED: 'No solved tickets yet.',
};

export function TicketsPage() {
  const tickets = useAuthorTickets();
  const [tab, setTab] = useState<TicketTab>('ALL');
  const [search, setSearch] = useState('');
  const all = tickets.data?.items ?? [];
  const counts = countByTab(all);
  const shown = filterTickets(all, tab, search);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold lg:text-[24px]">Your tickets</h1>
          <p className="text-[12.5px] text-ink-2">
            Replies from the team appear here as they arrive.
          </p>
        </div>
        <NewTicketLink />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs
          label="Filter tickets"
          value={tab}
          onChange={setTab}
          items={TICKET_TABS.map((t) => ({ value: t, label: TAB_LABELS[t], count: counts[t] }))}
        />
        <SearchBox value={search} onChange={setSearch} />
      </div>
      {tickets.isError ? (
        <ErrorState error={tickets.error} onRetry={() => void tickets.refetch()} />
      ) : (
        <Skeleton name="ticket-list" loading={tickets.isPending} fixture={<TicketCardFixture />}>
          {shown.length === 0 ? (
            <Card>
              <EmptyState
                title={search ? 'No tickets match your search' : 'Nothing here yet'}
                body={search ? 'Try other words, or clear the search.' : EMPTY_TEXT[tab]}
                action={tab === 'ALL' && !search ? <NewTicketLink /> : undefined}
              />
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {shown.map((t) => (
                <TicketCard key={t.id} ticket={t} />
              ))}
            </div>
          )}
        </Skeleton>
      )}
    </div>
  );
}
