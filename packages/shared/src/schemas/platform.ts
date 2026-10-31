import { z } from 'zod';
import { LIMIT_BOUNDS, PlanSchema, type LimitKey } from './plans.js';
import { PROVIDER_CAPABILITIES } from './provider-keys.js';

/**
 * The super admin console (/platform, U-7): the support provider's own operators. Separate
 * sign-in, cookie and token audience from customer staff. They see counts and usage only,
 * never ticket content.
 */
export const PlatformAdminSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
});
export type PlatformAdmin = z.infer<typeof PlatformAdminSchema>;

const ModelOptionSchema = z.object({ id: z.string(), label: z.string(), tier: z.string() });

export const PlatformAiSettingsSchema = z.object({
  provider: z.string(),
  triageModel: z.string(),
  draftModel: z.string(),
  chatModel: z.string(),
  /** Null = the server's VOICE_MODEL. */
  voiceModel: z.string().nullable(),
  /** On: every customer's AI is off (rule-based triage, template drafts, chat unavailable). */
  simulateOutage: z.boolean(),
  version: z.int(),
  updatedAt: z.iso.datetime(),
});
export type PlatformAiSettings = z.infer<typeof PlatformAiSettingsSchema>;

/** Where a provider's key comes from: saved in the console (wins), the server env, or nowhere. */
export const KEY_SOURCES = ['SAVED', 'ENV', 'NONE'] as const;
export type KeySource = (typeof KEY_SOURCES)[number];

export const PlatformProviderSchema = z.object({
  capability: z.enum(PROVIDER_CAPABILITIES),
  id: z.string(),
  label: z.string(),
  keySource: z.enum(KEY_SOURCES),
  /** Last four characters of the saved key; null for env or no key. */
  last4: z.string().nullable(),
  models: z.array(ModelOptionSchema),
});
export type PlatformProvider = z.infer<typeof PlatformProviderSchema>;

export const PlatformAiStatusSchema = z.object({
  settings: PlatformAiSettingsSchema,
  providers: z.array(PlatformProviderSchema),
  /** The server's VOICE_MODEL, used while no voice model is chosen here. */
  defaultVoiceModel: z.string(),
  /** False when the server has no SECRETS_MASTER_KEY: keys cannot be saved here. */
  secretsConfigured: z.boolean(),
  lastTest: z.object({ ok: z.boolean(), at: z.iso.datetime(), detail: z.string() }).nullable(),
  /** AI jobs that ended without AI in the last hour: a quiet outage shows here. */
  recentJobs: z.object({
    windowMinutes: z.int(),
    fallback: z.int(),
    failed: z.int(),
    /** Of those, how many failed on a bad or missing key / provider setup. */
    authOrNotConfigured: z.int(),
  }),
});
export type PlatformAiStatus = z.infer<typeof PlatformAiStatusSchema>;

const modelId = z.string().trim().min(1).max(80);

export const UpdatePlatformAiSettingsSchema = z
  .object({
    version: z.int().min(0),
    provider: z.string().trim().min(1).max(40).optional(),
    triageModel: modelId.optional(),
    draftModel: modelId.optional(),
    chatModel: modelId.optional(),
    voiceModel: modelId
      .regex(/^[a-z0-9][a-z0-9.-]*$/, 'Use the provider’s model id, e.g. gpt-realtime-2.1')
      .nullable()
      .optional(),
    simulateOutage: z.boolean().optional(),
  })
  .strict();
export type UpdatePlatformAiSettings = z.infer<typeof UpdatePlatformAiSettingsSchema>;

export const PlatformKeyParamsSchema = z.object({
  capability: z.enum(PROVIDER_CAPABILITIES),
  provider: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
});

export const SavePlatformKeySchema = z
  .object({
    apiKey: z
      .string()
      .trim()
      .min(20, 'That key looks too short')
      .max(400)
      .regex(/^[\x21-\x7e]+$/, 'A key has no spaces or special characters'),
  })
  .strict();
export type SavePlatformKey = z.infer<typeof SavePlatformKeySchema>;

/** Counts and cost only: no ticket subjects, messages or customer names ever leave here. */
export const CustomerUsageSchema = z.object({
  /** All time. */
  tickets: z.int(),
  /** The last 30 days, below. */
  ticketsRecent: z.int(),
  conversations: z.int(),
  calls: z.int(),
  callMinutes: z.int(),
  aiRuns: z.int(),
  /** Estimated text-model cost in micro-dollars (voice minutes are counted separately). */
  aiCostMicros: z.int(),
});
export type CustomerUsage = z.infer<typeof CustomerUsageSchema>;

export const CustomerSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  ticketPrefix: z.string(),
  isDefault: z.boolean(),
  createdAt: z.iso.datetime(),
  suspended: z.boolean(),
  staff: z.int(),
  plan: PlanSchema,
  planVersion: z.int(),
  usage: CustomerUsageSchema,
});
export type CustomerSummary = z.infer<typeof CustomerSummarySchema>;

export const CustomerListSchema = z.object({
  items: z.array(CustomerSummarySchema),
  /** Start of the "recent" window for the usage figures. */
  since: z.iso.datetime(),
});
export type CustomerList = z.infer<typeof CustomerListSchema>;

const maxLimit = (key: LimitKey) =>
  z.int().min(LIMIT_BOUNDS[key].min).max(LIMIT_BOUNDS[key].max).optional();

export const UpdatePlanSchema = z
  .object({
    version: z.int().min(0),
    chatAllowed: z.boolean().optional(),
    voiceAllowed: z.boolean().optional(),
    aiEnabled: z.boolean().optional(),
    suspended: z.boolean().optional(),
    max: z
      .object({
        messagesPerMinute: maxLimit('messagesPerMinute'),
        messagesPerDay: maxLimit('messagesPerDay'),
        maxTurnsPerSession: maxLimit('maxTurnsPerSession'),
        callsPerHour: maxLimit('callsPerHour'),
        callsPerDay: maxLimit('callsPerDay'),
        maxCallSeconds: maxLimit('maxCallSeconds'),
      })
      .strict()
      .optional(),
  })
  .strict();
export type UpdatePlan = z.infer<typeof UpdatePlanSchema>;

/** A customer's plan after a change, with its suspension and version. */
export const PlanStatusSchema = PlanSchema.extend({ suspended: z.boolean(), version: z.int() });
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

export const CustomerIdParamSchema = z.object({ id: z.uuid() });
