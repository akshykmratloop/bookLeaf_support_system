import { z } from 'zod';
import { WIDGET_THEMES } from './ai-behaviour.js';
import { PlanSchema } from './plans.js';

/** Admin switches for the author-facing assistant channels (chat and voice). */
export const AssistantSettingsSchema = z.object({
  chatEnabled: z.boolean(),
  voiceEnabled: z.boolean(),
  version: z.int(),
  updatedAt: z.iso.datetime(),
});
export type AssistantSettings = z.infer<typeof AssistantSettingsSchema>;

export const UpdateAssistantSettingsSchema = z
  .object({
    version: z.int().min(0),
    chatEnabled: z.boolean().optional(),
    voiceEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((v) => [v.chatEnabled, v.voiceEnabled].some((f) => f !== undefined), {
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
  /** The workspace's brand, for the widget and the author screens. */
  brand: z.object({
    name: z.string(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    logoUrl: z.string().nullable(),
    launcherText: z.string(),
    theme: z.enum(WIDGET_THEMES),
  }),
});
export type AssistantAvailability = z.infer<typeof AssistantAvailabilitySchema>;

/** Admin view: the switches, whether each channel could run, and what the plan allows. */
export const AssistantAdminStatusSchema = z.object({
  settings: AssistantSettingsSchema,
  availability: AssistantAvailabilitySchema,
  plan: PlanSchema,
  voiceConfigured: z.boolean(),
});
export type AssistantAdminStatus = z.infer<typeof AssistantAdminStatusSchema>;
