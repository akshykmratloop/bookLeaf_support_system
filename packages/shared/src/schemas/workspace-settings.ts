import { z } from 'zod';
import { cleanText } from '../sanitize.js';

/**
 * Everything a workspace controls about its assistant from the UI: models, tone, chat and
 * voice switches and limits, and the widget (allowed origins, branding, vocabulary).
 * Null model = the platform default for the active provider.
 */
const model = z.string().trim().min(1).max(80).nullable();
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
  triageModel: z.string().nullable(),
  draftModel: z.string().nullable(),
  chatModel: z.string().nullable(),
  toneGuide: z.string(),
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
  version: z.int(),
  updatedAt: z.iso.datetime(),
});
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;

export const UpdateWorkspaceSettingsSchema = z
  .object({
    version: z.int().min(0),
    triageModel: model.optional(),
    draftModel: model.optional(),
    chatModel: model.optional(),
    toneGuide: cleanText(0, 4000).optional(),
    chatEnabled: z.boolean().optional(),
    messagesPerMinute: z.int().min(1).max(120).optional(),
    messagesPerDay: z.int().min(1).max(2000).optional(),
    maxTurnsPerSession: z.int().min(1).max(200).optional(),
    voiceEnabled: z.boolean().optional(),
    voiceName: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9_-]+$/i)
      .optional(),
    maxCallSeconds: z.int().min(30).max(300).optional(),
    callsPerHour: z.int().min(1).max(60).optional(),
    callsPerDay: z.int().min(1).max(200).optional(),
    allowedOrigins: z.array(origin).max(10).optional(),
    brandName: cleanText(0, 60).optional(),
    brandColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-f]{6}$/i, 'Use a hex colour like #2f6b4f')
      .optional(),
    customerNoun: cleanText(1, 30).optional(),
    itemNoun: cleanText(1, 30).optional(),
  })
  .strict();
export type UpdateWorkspaceSettings = z.infer<typeof UpdateWorkspaceSettingsSchema>;

/** The admin screen: the settings plus the models the active provider allows. */
export const WorkspaceSettingsStatusSchema = z.object({
  settings: WorkspaceSettingsSchema,
  models: z.array(z.object({ id: z.string(), label: z.string(), tier: z.string() })),
  voiceConfigured: z.boolean(),
  /** Voices the platform's voice provider offers; empty when there is none. */
  voices: z.array(z.string()),
  aiConfigured: z.boolean(),
});
export type WorkspaceSettingsStatus = z.infer<typeof WorkspaceSettingsStatusSchema>;
