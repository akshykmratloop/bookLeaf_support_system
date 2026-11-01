import {
  AI_USAGE_FEATURES,
  microsToCredits,
  type AiFeatureUsage,
  type AiUsage,
  type AiUsageFeature,
  type AiUsageUnit,
} from '@bookleaf/shared';

/** AI runs of one task and outcome in the window: how many, and what they cost together. */
export interface RunGroup {
  task: string;
  outcome: 'OK' | 'ERROR';
  count: number;
  costMicros: number;
}

export interface UsageInput {
  runs: readonly RunGroup[];
  /** Seconds of every call in the window. */
  callSeconds: number;
  days: number;
  since: Date;
}

const UNIT_OF: Record<AiUsageFeature, AiUsageUnit> = {
  TRIAGE: 'ticket',
  DRAFT: 'draft',
  CHAT: 'reply',
  VOICE: 'minute',
};

const perUnit = (costMicros: number, units: number) =>
  units > 0 ? Math.round(costMicros / units) : null;

/** One feature's row: cost of all its runs; units are successful runs, or call minutes. */
function featureUsage(
  feature: AiUsageFeature,
  runs: readonly RunGroup[],
  callMinutes: number,
): AiFeatureUsage {
  const mine = runs.filter((r) => r.task === feature);
  const costMicros = mine.reduce((sum, r) => sum + r.costMicros, 0);
  const succeeded = mine.filter((r) => r.outcome === 'OK').reduce((sum, r) => sum + r.count, 0);
  const units = feature === 'VOICE' ? callMinutes : succeeded;
  return {
    feature,
    unit: UNIT_OF[feature],
    units,
    costMicros,
    costPerUnitMicros: perUnit(costMicros, units),
  };
}

/**
 * A workspace's AI cost per feature. The total is the four features only, so the table adds up:
 * the support provider's connection tests (task TEST) are its own cost, not the customer's.
 */
export function summarizeUsage({ runs, callSeconds, days, since }: UsageInput): AiUsage {
  const callMinutes = Math.round(callSeconds / 6) / 10;
  const features = AI_USAGE_FEATURES.map((f) => featureUsage(f, runs, callMinutes));
  const cost = (f: AiUsageFeature) => features.find((x) => x.feature === f)?.costMicros ?? 0;
  const ticketsSorted = features.find((x) => x.feature === 'TRIAGE')?.units ?? 0;
  const totalCostMicros = features.reduce((sum, f) => sum + f.costMicros, 0);
  return {
    days,
    since: since.toISOString(),
    totalCostMicros,
    totalCredits: microsToCredits(totalCostMicros),
    features,
    perTicketMicros: perUnit(cost('TRIAGE') + cost('DRAFT'), ticketsSorted),
  };
}
