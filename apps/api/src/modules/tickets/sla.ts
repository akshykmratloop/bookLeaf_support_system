import type { Priority } from '@bookleaf/shared';

/** First-response targets by priority (hours). */
export const SLA_HOURS: Record<Priority, number> = { CRITICAL: 4, HIGH: 24, MEDIUM: 48, LOW: 72 };

export function slaDueAt(createdAt: Date, priority: Priority): Date {
  return new Date(createdAt.getTime() + SLA_HOURS[priority] * 3_600_000);
}
