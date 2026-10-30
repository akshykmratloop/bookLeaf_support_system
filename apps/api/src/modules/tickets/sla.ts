import type { Priority } from '@bookleaf/shared';

/** First-response targets by priority (hours). */
export const SLA_HOURS: Record<Priority, number> = { CRITICAL: 4, HIGH: 24, MEDIUM: 48, LOW: 72 };

const HOUR_MS = 3_600_000;

/**
 * First-response deadline: the priority's target, or the category's own target (S.9) when that
 * is sooner. A category without SLA hours leaves the priority's target alone.
 */
export function slaDueAt(createdAt: Date, priority: Priority, categorySlaHours?: number | null) {
  const hours = Math.min(SLA_HOURS[priority], categorySlaHours ?? Number.POSITIVE_INFINITY);
  return new Date(createdAt.getTime() + hours * HOUR_MS);
}
