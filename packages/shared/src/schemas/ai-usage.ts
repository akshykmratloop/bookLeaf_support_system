import { z } from 'zod';

/**
 * AI cost shown to admins (no payments): money in micro-dollars, and the same amount in credits.
 * 1 credit = $0.001 = 1,000 micro-dollars. The API and the web app both read this constant.
 */
export const MICROS_PER_CREDIT = 1_000;

/** Micro-dollars as credits, to two decimals (1,234 → 1.23). */
export function microsToCredits(micros: number): number {
  return Math.round(micros / (MICROS_PER_CREDIT / 100)) / 100;
}

/** What admins see AI cost for. Connection tests by the support provider are not a feature. */
export const AI_USAGE_FEATURES = ['TRIAGE', 'DRAFT', 'CHAT', 'VOICE'] as const;
export const AiUsageFeatureSchema = z.enum(AI_USAGE_FEATURES);
export type AiUsageFeature = z.infer<typeof AiUsageFeatureSchema>;

/** The unit each feature is counted in: tickets sorted, drafts written, chat replies, call minutes. */
export const AiUsageUnitSchema = z.enum(['ticket', 'draft', 'reply', 'minute']);
export type AiUsageUnit = z.infer<typeof AiUsageUnitSchema>;

export const AiFeatureUsageSchema = z.object({
  feature: AiUsageFeatureSchema,
  unit: AiUsageUnitSchema,
  /** How many units were used; call minutes to one decimal. */
  units: z.number().min(0),
  costMicros: z.int().min(0),
  /** Average cost of one unit; null when nothing was used. */
  costPerUnitMicros: z.int().min(0).nullable(),
});
export type AiFeatureUsage = z.infer<typeof AiFeatureUsageSchema>;

/** One workspace's AI cost over the last `days` days, at the providers' published prices. */
export const AiUsageSchema = z.object({
  days: z.int().min(1),
  since: z.iso.datetime(),
  totalCostMicros: z.int().min(0),
  totalCredits: z.number().min(0),
  features: z.array(AiFeatureUsageSchema),
  /** Sorting plus drafting, per ticket sorted; null when no ticket was sorted. */
  perTicketMicros: z.int().min(0).nullable(),
});
export type AiUsage = z.infer<typeof AiUsageSchema>;
