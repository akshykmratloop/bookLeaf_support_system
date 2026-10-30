import type { CustomerList } from '@bookleaf/shared';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { CustomerTable } from '../../components/organisms/platform/CustomerTable';
import { formatCost, useCustomers } from '../../lib/platform';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-panel p-4 shadow-soft">
      <p className="font-mono text-[10.5px] tracking-[0.08em] text-ink-3 uppercase">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Totals({ list }: { list: CustomerList }) {
  const sum = (pick: (u: CustomerList['items'][number]['usage']) => number) =>
    list.items.reduce((n, c) => n + pick(c.usage), 0);
  const active = list.items.filter((c) => !c.suspended).length;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Customers" value={`${active} active / ${list.items.length}`} />
      <Stat label="Tickets · 30 days" value={sum((u) => u.ticketsRecent).toLocaleString('en-US')} />
      <Stat label="Call minutes" value={sum((u) => u.callMinutes).toLocaleString('en-US')} />
      <Stat label="AI cost" value={formatCost(sum((u) => u.aiCostMicros))} />
    </div>
  );
}

/** /platform: every customer with plan, status and usage counts. Never ticket content. */
export function CustomersPage() {
  const customers = useCustomers();
  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Plans, status and usage for every workspace. Usage counts only — no ticket content."
      />
      {customers.isPending ? <LoadingState label="Loading customers…" /> : null}
      {customers.isError ? (
        <ErrorState error={customers.error} onRetry={() => void customers.refetch()} />
      ) : null}
      {customers.data ? (
        <>
          <Totals list={customers.data} />
          {customers.data.items.length === 0 ? (
            <EmptyState title="No customers yet" body="Companies appear here once they sign up." />
          ) : (
            <CustomerTable items={customers.data.items} />
          )}
          <p className="mt-3 text-[12px] text-ink-3">
            Recent figures cover activity since{' '}
            {new Date(customers.data.since).toLocaleDateString()}. AI cost is an estimate for text
            models.
          </p>
        </>
      ) : null}
    </div>
  );
}
