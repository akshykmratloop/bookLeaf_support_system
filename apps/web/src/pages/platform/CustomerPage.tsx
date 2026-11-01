import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Pill } from '../../components/atoms/Pill';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { AiUsagePanel } from '../../components/organisms/AiUsagePanel';
import { PlanEditor } from '../../components/organisms/platform/PlanEditor';
import { SuspendCard } from '../../components/organisms/platform/SuspendCard';
import { useCustomerAiUsage } from '../../lib/aiUsage';
import { formatCost, useCustomers } from '../../lib/platform';

const BACK = (
  <Link
    to="/platform"
    className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink focus-visible:ring-4 focus-visible:ring-brand/25 focus-visible:outline-none"
  >
    <ArrowLeft size={14} aria-hidden /> All customers
  </Link>
);

/** The customer's AI cost: the same card its own admins see on /admin/usage. */
function CustomerUsage({ id }: { id: string }) {
  const usage = useCustomerAiUsage(id);
  return (
    <section aria-labelledby="customer-ai-usage" className="flex flex-col gap-3">
      <h2 id="customer-ai-usage" className="text-[15px] font-semibold">
        AI usage
      </h2>
      <AiUsagePanel query={usage} />
    </section>
  );
}

/** /platform/customers/:id — one customer's AI usage, plan, limits and status. */
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
      <CustomerUsage id={customer.id} />
      <PlanEditor key={`${customer.id}-${customer.planVersion}`} customer={customer} />
      <SuspendCard customer={customer} />
    </div>
  );
}
