import { z } from 'zod';

/**
 * The widest value each customer limit may take, and the plan maximum every customer starts
 * with (U-7). A super admin may lower a customer's maximum; the customer then sets its own limit
 * anywhere from the floor up to that maximum, and the server refuses anything above it.
 */
export const LIMIT_BOUNDS = {
  messagesPerMinute: { min: 1, max: 120 },
  messagesPerDay: { min: 1, max: 2000 },
  maxTurnsPerSession: { min: 1, max: 200 },
  callsPerHour: { min: 1, max: 60 },
  callsPerDay: { min: 1, max: 200 },
  maxCallSeconds: { min: 30, max: 300 },
} as const;
export type LimitKey = keyof typeof LIMIT_BOUNDS;
export const LIMIT_KEYS = Object.keys(LIMIT_BOUNDS) as LimitKey[];

const bounded = (key: LimitKey) => z.int().min(LIMIT_BOUNDS[key].min).max(LIMIT_BOUNDS[key].max);

/** What one customer's plan allows: features, AI on/off and the most each limit may be set to. */
export const PlanSchema = z.object({
  chatAllowed: z.boolean(),
  voiceAllowed: z.boolean(),
  /** False: AI is off for this customer (rule-based triage and template drafts only). */
  aiEnabled: z.boolean(),
  max: z.object({
    messagesPerMinute: bounded('messagesPerMinute'),
    messagesPerDay: bounded('messagesPerDay'),
    maxTurnsPerSession: bounded('maxTurnsPerSession'),
    callsPerHour: bounded('callsPerHour'),
    callsPerDay: bounded('callsPerDay'),
    maxCallSeconds: bounded('maxCallSeconds'),
  }),
});
export type Plan = z.infer<typeof PlanSchema>;

/** A customer without a saved plan, and every new customer: everything allowed, widest limits. */
export const DEFAULT_PLAN: Plan = {
  chatAllowed: true,
  voiceAllowed: true,
  aiEnabled: true,
  max: {
    messagesPerMinute: LIMIT_BOUNDS.messagesPerMinute.max,
    messagesPerDay: LIMIT_BOUNDS.messagesPerDay.max,
    maxTurnsPerSession: LIMIT_BOUNDS.maxTurnsPerSession.max,
    callsPerHour: LIMIT_BOUNDS.callsPerHour.max,
    callsPerDay: LIMIT_BOUNDS.callsPerDay.max,
    maxCallSeconds: LIMIT_BOUNDS.maxCallSeconds.max,
  },
};
