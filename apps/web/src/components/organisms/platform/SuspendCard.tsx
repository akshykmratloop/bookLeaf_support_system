import type { CustomerSummary } from '@bookleaf/shared';
import { Button } from '../../atoms/Button';
import { Card } from '../../atoms/Card';
import { useToast } from '../../molecules/Toast';
import { errorMessage } from '../../../lib/api';
import { platformKeys, updateCustomerPlan } from '../../../lib/platform';
import { useApiMutation } from '../../../lib/queries';

/** Suspend signs every staff member out and stops the widget and API keys; resume undoes it. */
export function SuspendCard({ customer }: { customer: CustomerSummary }) {
  const toast = useToast();
  const change = useApiMutation(updateCustomerPlan, [platformKeys.customers]);
  const next = !customer.suspended;
  const run = () => {
    if (next && !window.confirm(`Suspend ${customer.name}? Their staff are signed out at once.`))
      return;
    change.mutate(
      { id: customer.id, version: customer.planVersion, suspended: next },
      {
        onSuccess: () => toast('success', next ? 'Customer suspended' : 'Customer resumed'),
        onError: (err) => toast('error', errorMessage(err)),
      },
    );
  };
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">
          {customer.suspended ? 'Suspended' : 'Account status'}
        </h2>
        <p className="text-[12.5px] text-ink-2">
          {customer.suspended
            ? 'Staff cannot sign in, and the widget and API keys are refused.'
            : 'Suspending signs every staff member out and refuses the widget and API keys.'}
        </p>
      </div>
      <Button variant={next ? 'danger' : 'secondary'} onClick={run} isLoading={change.isPending}>
        {next ? 'Suspend customer' : 'Resume customer'}
      </Button>
    </Card>
  );
}
