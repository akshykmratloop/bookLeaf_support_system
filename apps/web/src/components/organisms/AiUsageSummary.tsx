import { MICROS_PER_CREDIT, type AiFeatureUsage, type AiUsage } from '@bookleaf/shared';
import { Card } from '../atoms/Card';
import {
  FEATURE_LABELS,
  formatCredits,
  formatUnits,
  formatUsd,
  perUnitName,
} from '../../lib/aiUsage';

const HEADINGS = ['Feature', 'Used', 'Cost', 'Cost per unit'] as const;
const cell = 'px-4 py-2.5 text-left';
const numberCell = `${cell} font-mono text-[13px] tabular-nums`;

function FeatureRow({ f }: { f: AiFeatureUsage }) {
  return (
    <tr className="border-t border-line">
      <th scope="row" className={`${cell} text-[13px] font-medium`}>
        {FEATURE_LABELS[f.feature]}
      </th>
      <td className={numberCell}>{formatUnits(f.unit, f.units)}</td>
      <td className={numberCell}>{formatUsd(f.costMicros)}</td>
      <td className={numberCell}>
        {f.costPerUnitMicros === null
          ? '—'
          : `${formatUsd(f.costPerUnitMicros)} / ${perUnitName(f.unit)}`}
      </td>
    </tr>
  );
}

function UsageTable({ features }: { features: AiFeatureUsage[] }) {
  return (
    <div className="overflow-x-auto rounded-control border border-line">
      <table className="w-full min-w-[480px] border-collapse">
        <thead className="bg-panel-2">
          <tr>
            {HEADINGS.map((h) => (
              <th
                key={h}
                scope="col"
                className={`${cell} font-mono text-[10.5px] font-medium tracking-[0.08em] text-ink-3 uppercase`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <FeatureRow key={f.feature} f={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const isEmpty = (u: AiUsage) => u.totalCostMicros === 0 && u.features.every((f) => f.units === 0);

/**
 * What AI cost a workspace over the last 30 days: the total in dollars and credits, one row per
 * feature, and the cost of one ticket. Shared by the admin's page and the super admin console.
 */
export function AiUsageSummary({ usage }: { usage: AiUsage }) {
  return (
    <Card className="flex max-w-[880px] min-w-0 flex-col gap-4 p-5">
      <div>
        <p className="text-[11.5px] font-semibold text-ink-3 uppercase">Last {usage.days} days</p>
        <p className="font-mono text-[28px] font-semibold tabular-nums">
          {formatUsd(usage.totalCostMicros)}
        </p>
        <p className="text-[13px] text-ink-2">{formatCredits(usage.totalCredits)}</p>
      </div>
      {isEmpty(usage) ? (
        <p className="text-[13px] text-ink-2">
          No AI usage in the last {usage.days} days. Costs appear here once tickets are sorted,
          drafts written, or authors use chat or voice.
        </p>
      ) : (
        <>
          <UsageTable features={usage.features} />
          {usage.perTicketMicros === null ? null : (
            <p className="text-[13px]">
              Per ticket (sort + draft):{' '}
              <span className="font-mono tabular-nums">{formatUsd(usage.perTicketMicros)}</span>
            </p>
          )}
        </>
      )}
      <p className="text-[12px] text-ink-3">
        Prices are the AI providers’ published rates. 1 credit = {formatUsd(MICROS_PER_CREDIT)}.
      </p>
    </Card>
  );
}
