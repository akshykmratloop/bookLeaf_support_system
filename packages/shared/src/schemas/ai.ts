import { z } from 'zod';

export const AiSettingsSchema = z.object({
  provider: z.string(),
  triageModel: z.string(),
  draftModel: z.string(),
  simulateOutage: z.boolean(),
  version: z.int(),
  updatedAt: z.iso.datetime(),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

export const AiStatusSchema = z.object({
  settings: AiSettingsSchema,
  providers: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      configured: z.boolean(),
      models: z.array(z.object({ id: z.string(), label: z.string(), tier: z.string() })),
    }),
  ),
  lastTest: z.object({ ok: z.boolean(), at: z.iso.datetime(), detail: z.string() }).nullable(),
});
export type AiStatus = z.infer<typeof AiStatusSchema>;

export const UpdateAiSettingsSchema = z.object({
  version: z.int().min(0),
  provider: z.string().min(1).max(40).optional(),
  triageModel: z.string().min(1).max(80).optional(),
  draftModel: z.string().min(1).max(80).optional(),
  simulateOutage: z.boolean().optional(),
});
export type UpdateAiSettings = z.infer<typeof UpdateAiSettingsSchema>;

export const AiTestResultSchema = z.object({ ok: z.boolean(), detail: z.string() });
