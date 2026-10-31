import { useDeferredValue, useState } from 'react';
import { Card } from '../../components/atoms/Card';
import { LoadMore } from '../../components/molecules/LoadMore';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { QueueFilters } from '../../components/organisms/QueueFilters';
import { QueueTable } from '../../components/organisms/QueueTable';
import { sla } from '../../lib/format';
import { EMPTY_FILTERS, isFiltered, type QueueFilterValues } from '../../lib/queueFilters';
import { useAdminTickets } from '../../lib/queries';

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
      <p
        className={`mt-0.5 font-mono text-[22px] font-semibold ${value > 0 ? tone : 'text-ink-3'}`}
      >
        {value}
      </p>
    </Card>
  );
}

const ORDER_NOTES: Record<string, string> = {
  oldest: 'Oldest tickets first.',
  newest: 'Newest tickets first.',
};
const orderNote = (sort: string) =>
  ORDER_NOTES[sort] ??
  'Most urgent first: unresolved, then priority, then the nearest response deadline.';

export function QueuePage() {
  const [filters, setFilters] = useState<QueueFilterValues>(EMPTY_FILTERS);
  const deferred = useDeferredValue(filters);
  const tickets = useAdminTickets({ ...deferred });
  const items = tickets.data?.items ?? [];
  const unresolved = items.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const urgent = unresolved.filter(
    (t) => t.priority === 'CRITICAL' || t.priority === 'HIGH',
  ).length;
  const overdue = unresolved.filter((t) => sla(t.slaDueAt, t.firstResponseAt).overdue).length;
  const review = unresolved.filter((t) => t.needsReview || t.aiState === 'FALLBACK').length;
  const filtered = isFiltered(filters);
  return (
    <>
      <PageHeader title="Ticket Queue" subtitle={orderNote(filters.sort)} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Count label="Unresolved" value={unresolved.length} tone="text-info" />
        <Count label="Critical / High" value={urgent} tone="text-danger" />
        <Count label="Response overdue" value={overdue} tone="text-danger" />
        <Count label="Needs review" value={review} tone="text-accent" />
      </div>
      <QueueFilters value={filters} onChange={setFilters} />
      <Card>
        {tickets.isPending ? <LoadingState label="Loading tickets…" /> : null}
        {tickets.isError ? (
          <ErrorState error={tickets.error} onRetry={() => void tickets.refetch()} />
        ) : null}
        {tickets.data && items.length === 0 ? (
          <EmptyState
            title={filtered ? 'No tickets match these filters' : 'No tickets yet'}
            body={
              filtered ? 'Try clearing a filter.' : 'New author tickets will appear here instantly.'
            }
          />
        ) : null}
        {items.length > 0 ? <QueueTable items={items} /> : null}
        <LoadMore
          noun="tickets"
          hasMore={tickets.hasNextPage}
          isLoading={tickets.isFetchingNextPage}
          onLoad={() => void tickets.fetchNextPage()}
        />
      </Card>
    </>
  );
}
