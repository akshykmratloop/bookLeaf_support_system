import type { CustomerSummary, LimitKey, Plan } from '@bookleaf/shared';
import { useState } from 'react';
import { Button } from '../../atoms/Button';
import { Card } from '../../atoms/Card';
import { SwitchRow } from '../../molecules/SwitchRow';
import { useToast } from '../../molecules/Toast';
import { errorMessage } from '../../../lib/api';
import { platformKeys, updateCustomerPlan } from '../../../lib/platform';
import { useApiMutation } from '../../../lib/queries';
import { PlanLimits, limitErrors } from './PlanLimits';

type Flag = 'chatAllowed' | 'voiceAllowed' | 'aiEnabled';

const FLAGS: { key: Flag; label: string; description: string }[] = [
  {
    key: 'aiEnabled',
    label: 'AI on',
    description: 'Off: rule-based triage and template drafts only, chat and calls unavailable.',
  },
  {
    key: 'chatAllowed',
    label: 'Chat allowed',
    description: 'The customer may switch on the AI chat widget.',
  },
  {
    key: 'voiceAllowed',
    label: 'Voice allowed',
    description: 'The customer may switch on AI voice calls.',
  },
];

/** One customer's plan: features, AI on/off and maximum limits, saved together with its version. */
export function PlanEditor({ customer }: { customer: CustomerSummary }) {
  const toast = useToast();
  const [plan, setPlan] = useState<Plan>(customer.plan);
  const save = useApiMutation(updateCustomerPlan, [platformKeys.customers]);
  const errors = limitErrors(plan.max);
  const isValid = Object.keys(errors).length === 0;
  const setFlag = (key: Flag, value: boolean) => setPlan((p) => ({ ...p, [key]: value }));
  const setMax = (key: LimitKey, value: number) =>
    setPlan((p) => ({ ...p, max: { ...p.max, [key]: value } }));
  const submit = () =>
    save.mutate(
      { id: customer.id, version: customer.planVersion, ...plan },
      {
        onSuccess: () => toast('success', 'Plan saved'),
        onError: (err) => toast('error', errorMessage(err)),
      },
    );
  return (
    <Card className="flex flex-col gap-6 p-5">
      <section aria-labelledby="plan-features" className="flex flex-col gap-4">
        <h2 id="plan-features" className="text-[15px] font-semibold">
          Features
        </h2>
        {FLAGS.map((f) => (
          <SwitchRow
            key={f.key}
            id={`plan-${f.key}`}
            label={f.label}
            description={f.description}
            checked={plan[f.key]}
            onChange={(v) => setFlag(f.key, v)}
          />
        ))}
      </section>
      <section aria-labelledby="plan-limits" className="flex flex-col gap-4">
        <div>
          <h2 id="plan-limits" className="text-[15px] font-semibold">
            Maximum limits
          </h2>
          <p className="text-[12.5px] text-ink-2">
            The customer sets its own limits up to these. Lowering one lowers any setting above it.
          </p>
        </div>
        <PlanLimits max={plan.max} onChange={setMax} errors={errors} />
      </section>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setPlan(customer.plan)} disabled={save.isPending}>
          Reset
        </Button>
        <Button onClick={submit} isLoading={save.isPending} disabled={!isValid}>
          Save plan
        </Button>
      </div>
    </Card>
  );
}
