import { z } from 'zod';

/**
 * The "Get started" setup guide (U-12): eight steps, each ticked by a real check on the server,
 * never by a click. The guide's wording lives in the web app; the server only says how far each
 * step is and why.
 */
export const ONBOARDING_STEP_IDS = [
  'connect',
  'fields',
  'signIn',
  'widget',
  'origins',
  'teach',
  'extras',
  'test',
] as const;
export const OnboardingStepIdSchema = z.enum(ONBOARDING_STEP_IDS);
export type OnboardingStepId = z.infer<typeof OnboardingStepIdSchema>;

/** done: the check passes · todo: not yet · broken: it was set up but fails (with the reason). */
export const ONBOARDING_STEP_STATES = ['done', 'todo', 'broken'] as const;
export const OnboardingStepStateSchema = z.enum(ONBOARDING_STEP_STATES);
export type OnboardingStepState = z.infer<typeof OnboardingStepStateSchema>;

/** Steps that do not block "Setup complete": an admin may skip them. */
export const OPTIONAL_ONBOARDING_STEPS: readonly OnboardingStepId[] = ['extras'];

/**
 * The customer a "Send a test ticket" ticket is raised for. Its tickets never tick the "Test it"
 * step: only a ticket from a real customer does.
 */
export const SETUP_TEST_CUSTOMER_ID = 'bookleaf-setup-test';

export const OnboardingStepSchema = z.object({
  id: OnboardingStepIdSchema,
  state: OnboardingStepStateSchema,
  optional: z.boolean(),
  /** One plain sentence: what the check found, or why the step is broken. */
  detail: z.string().max(500),
  /** When the check last passed (a test, a sign-in, a widget load, a ticket); null if never. */
  at: z.string().nullable(),
});
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;

export const OnboardingTestTicketSchema = z.object({
  id: z.uuid(),
  /** The ticket's label, e.g. `BL-1004`. */
  label: z.string().max(40),
  createdAt: z.string(),
});
export type OnboardingTestTicket = z.infer<typeof OnboardingTestTicketSchema>;

export const OnboardingStatusSchema = z.object({
  workspace: z.object({ slug: z.string().max(40), name: z.string().max(200) }),
  /** Where the support app runs (APP_ORIGIN): the widget script and frame come from here. */
  supportUrl: z.string().max(2048),
  /** The integration guide (docs/integration.md) when the server has its address; else null. */
  docsUrl: z.string().max(2048).nullable(),
  steps: z.array(OnboardingStepSchema).length(ONBOARDING_STEP_IDS.length),
  /** The latest "Send a test ticket" ticket, or null. */
  testTicket: OnboardingTestTicketSchema.nullable(),
});
export type OnboardingStatus = z.infer<typeof OnboardingStatusSchema>;
