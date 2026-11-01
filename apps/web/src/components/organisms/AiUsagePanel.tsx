import type { AiUsage } from '@bookleaf/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { Skeleton } from '../atoms/Skeleton';
import { ErrorState } from '../molecules/States';
import { AiUsageSummary } from './AiUsageSummary';

/** Example report the boneyard CLI measures to capture the card's loading shape. */
const FIXTURE: AiUsage = {
  days: 30,
  since: '2026-10-03T00:00:00.000Z',
  totalCostMicros: 94_900,
  totalCredits: 94.9,
  features: [
    { feature: 'TRIAGE', unit: 'ticket', units: 2, costMicros: 600, costPerUnitMicros: 300 },
    { feature: 'DRAFT', unit: 'draft', units: 1, costMicros: 4_000, costPerUnitMicros: 4_000 },
    { feature: 'CHAT', unit: 'reply', units: 3, costMicros: 300, costPerUnitMicros: 100 },
    { feature: 'VOICE', unit: 'minute', units: 1.5, costMicros: 90_000, costPerUnitMicros: 60_000 },
  ],
  perTicketMicros: 2_300,
};

/** The usage card with its loading shape and error state, for either screen's query. */
export function AiUsagePanel({ query }: { query: UseQueryResult<AiUsage> }) {
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <Skeleton
      name="ai-usage"
      loading={query.isPending}
      fixture={<AiUsageSummary usage={FIXTURE} />}
    >
      {query.data ? <AiUsageSummary usage={query.data} /> : null}
    </Skeleton>
  );
}
