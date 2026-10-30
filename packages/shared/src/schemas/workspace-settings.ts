import { z } from 'zod';
import { cleanText } from '../sanitize.js';
import {
  MAX_TOPICS,
  REPLY_FORMALITIES,
  REPLY_LANGUAGES,
  REPLY_LENGTHS,
  TopicSchema,
  WIDGET_THEMES,
} from './ai-behaviour.js';
import { LIMIT_BOUNDS, PlanSchema, type LimitKey } from './plans.js';

/**
 * Everything a customer controls about its assistant from the UI (U-7): AI behaviour, chat and
 * voice switches and limits (up to its plan's maximum), and the widget (allowed origins,
 * branding, vocabulary). Providers, models and keys are the support provider's: see
 * MANAGED_SETTING_KEYS.
 */
/** Fields only the support provider sets now; a customer sending one gets 403 (U-7). */
export const MANAGED_SETTING_KEYS = ['triageModel', 'draftModel', 'chatModel'] as const;
const limit = (key: LimitKey) =>
  z.int().min(LIMIT_BOUNDS[key].min).max(LIMIT_BOUNDS[key].max).optional();
/** A logo address: https only, so the widget never loads mixed or script content. */
const logoUrl = z
  .url({ protocol: /^https$/, error: 'Use an https:// image address' })
  .max(2048)
  .nullable();
const ORIGIN_HINT = 'Use a page origin, like https://app.example.com';
/**
 * A web page's origin (scheme, host, port): anything else is refused. A path is trimmed off,
 * keeping the scheme and host only, without needing the DOM URL type here.
 */
const origin = z
  .url({ protocol: /^https?$/, error: ORIGIN_HINT })
  .max(2048)
  .transform((u) => u.replace(/^(https?:\/\/[^/?#]+).*$/i, '$1').toLowerCase())
  .pipe(z.string().regex(/^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/, ORIGIN_HINT));

export const WorkspaceSettingsSchema = z.object({
  toneGuide: z.string(),
  greeting: z.string(),
  signature: z.string(),
  replyLanguage: z.enum(REPLY_LANGUAGES).nullable(),
  replyLength: z.enum(REPLY_LENGTHS).nullable(),
  formality: z.enum(REPLY_FORMALITIES).nullable(),
  topicsToAvoid: z.array(z.string()),
  chatEnabled: z.boolean(),
  messagesPerMinute: z.int(),
  messagesPerDay: z.int(),
  maxTurnsPerSession: z.int(),
  voiceEnabled: z.boolean(),
  voiceName: z.string(),
  maxCallSeconds: z.int(),
  callsPerHour: z.int(),
  callsPerDay: z.int(),
  allowedOrigins: z.array(z.string()),
  brandName: z.string(),
  brandColor: z.string(),
  customerNoun: z.string(),
  itemNoun: z.string(),
  logoUrl: z.string().nullable(),
  launcherText: z.string(),
  widgetTheme: z.enum(WIDGET_THEMES),
  version: z.int(),
  updatedAt: z.iso.datetime(),
});
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;

export const UpdateWorkspaceSettingsSchema = z
  .object({
    version: z.int().min(0),
    toneGuide: cleanText(0, 4000).optional(),
    greeting: cleanText(0, 200).optional(),
    signature: cleanText(0, 200).optional(),
    replyLanguage: z.enum(REPLY_LANGUAGES).nullable().optional(),
    replyLength: z.enum(REPLY_LENGTHS).nullable().optional(),
    formality: z.enum(REPLY_FORMALITIES).nullable().optional(),
    topicsToAvoid: z.array(TopicSchema).max(MAX_TOPICS).optional(),
    chatEnabled: z.boolean().optional(),
    messagesPerMinute: limit('messagesPerMinute'),
    messagesPerDay: limit('messagesPerDay'),
    maxTurnsPerSession: limit('maxTurnsPerSession'),
    voiceEnabled: z.boolean().optional(),
    voiceName: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9_-]+$/i)
      .optional(),
    maxCallSeconds: limit('maxCallSeconds'),
    callsPerHour: limit('callsPerHour'),
    callsPerDay: limit('callsPerDay'),
    allowedOrigins: z.array(origin).max(10).optional(),
    brandName: cleanText(0, 60).optional(),
    brandColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-f]{6}$/i, 'Use a hex colour like #2f6b4f')
      .optional(),
    customerNoun: cleanText(1, 30).optional(),
    itemNoun: cleanText(1, 30).optional(),
    logoUrl: logoUrl.optional(),
    launcherText: cleanText(0, 30).optional(),
    widgetTheme: z.enum(WIDGET_THEMES).optional(),
  })
  .strict();
export type UpdateWorkspaceSettings = z.infer<typeof UpdateWorkspaceSettingsSchema>;

/** The admin screen: the settings, the plan that caps them, and what the platform can run. */
export const WorkspaceSettingsStatusSchema = z.object({
  settings: WorkspaceSettingsSchema,
  /** Set by the support provider: features allowed and the most each limit may be set to. */
  plan: PlanSchema,
  voiceConfigured: z.boolean(),
  /** The approved voices (the platform voice provider's); empty when there is none. */
  voices: z.array(z.string()),
  aiConfigured: z.boolean(),
});
export type WorkspaceSettingsStatus = z.infer<typeof WorkspaceSettingsStatusSchema>;
