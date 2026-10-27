import { z } from 'zod';

/** Admin switches for the author-facing assistant channels (chat and voice). */
export const AssistantSettingsSchema = z.object({
  chatEnabled: z.boolean(),
  voiceEnabled: z.boolean(),
  chatModel: z.string(),
  version: z.int(),
  updatedAt: z.iso.datetime(),
});
export type AssistantSettings = z.infer<typeof AssistantSettingsSchema>;

export const UpdateAssistantSettingsSchema = z
  .object({
    version: z.int().min(0),
    chatEnabled: z.boolean().optional(),
    voiceEnabled: z.boolean().optional(),
    chatModel: z.string().trim().min(1).max(80).optional(),
  })
  .refine((v) => [v.chatEnabled, v.voiceEnabled, v.chatModel].some((f) => f !== undefined), {
    message: 'Provide at least one field to update',
  });
export type UpdateAssistantSettings = z.infer<typeof UpdateAssistantSettingsSchema>;

/**
 * Why a channel can or cannot be used right now. DISABLED = switched off by an admin;
 * NOT_CONFIGURED = the server has no credential for it; AI_OUTAGE = the AI is down or simulated down.
 */
export const CHANNEL_STATES = ['AVAILABLE', 'DISABLED', 'NOT_CONFIGURED', 'AI_OUTAGE'] as const;
export type ChannelState = (typeof CHANNEL_STATES)[number];

export const AssistantAvailabilitySchema = z.object({
  chat: z.object({
    state: z.enum(CHANNEL_STATES),
    maxMessageChars: z.int(),
    maxTurnsPerSession: z.int(),
    messagesPerMinute: z.int(),
    messagesPerDay: z.int(),
  }),
  voice: z.object({
    state: z.enum(CHANNEL_STATES),
    maxCallSeconds: z.int(),
    callsPerHour: z.int(),
    callsPerDay: z.int(),
  }),
});
export type AssistantAvailability = z.infer<typeof AssistantAvailabilitySchema>;

/** Admin view: the switches plus whether each channel could actually run. */
export const AssistantAdminStatusSchema = z.object({
  settings: AssistantSettingsSchema,
  availability: AssistantAvailabilitySchema,
  chatModels: z.array(z.object({ id: z.string(), label: z.string(), tier: z.string() })),
  voiceConfigured: z.boolean(),
});
export type AssistantAdminStatus = z.infer<typeof AssistantAdminStatusSchema>;
