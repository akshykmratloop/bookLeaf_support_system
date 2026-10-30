import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Pill } from '../../components/atoms/Pill';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { PlanEditor } from '../../components/organisms/platform/PlanEditor';
import { SuspendCard } from '../../components/organisms/platform/SuspendCard';
import { formatCost, useCustomers } from '../../lib/platform';

const BACK = (
  <Link
    to="/platform"
    className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink focus-visible:ring-4 focus-visible:ring-brand/25 focus-visible:outline-none"
  >
    <ArrowLeft size={14} aria-hidden /> All customers
  </Link>
);

/** /platform/customers/:id — one customer's plan, limits and status. */
export function CustomerPage() {
  const { id } = useParams();
  const customers = useCustomers();
  if (customers.isPending) return <LoadingState label="Loading customer…" />;
  if (customers.isError) {
    return <ErrorState error={customers.error} onRetry={() => void customers.refetch()} />;
  }
  const customer = customers.data.items.find((c) => c.id === id);
  if (!customer) {
    return (
      <div>
        {BACK}
        <EmptyState title="Customer not found" body="It may have been removed." />
      </div>
    );
  }
  const u = customer.usage;
  return (
    <div className="flex flex-col gap-5">
      <div>
        {BACK}
        <PageHeader
          title={customer.name}
          subtitle={`${customer.slug} · ${customer.staff} staff · ${u.tickets.toLocaleString('en-US')} tickets · ${u.callMinutes} call minutes · AI cost ${formatCost(u.aiCostMicros)}`}
          actions={
            customer.suspended ? (
              <Pill tone="danger" dot>
                Suspended
              </Pill>
            ) : (
              <Pill tone="success" dot>
                Active
              </Pill>
            )
          }
        />
      </div>
      <PlanEditor key={`${customer.id}-${customer.planVersion}`} customer={customer} />
      <SuspendCard customer={customer} />
    </div>
  );
}
