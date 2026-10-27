import { z } from 'zod';

/** What a workspace's own provider key is for. */
export const PROVIDER_CAPABILITIES = ['AI', 'VOICE'] as const;
export const ProviderCapabilitySchema = z.enum(PROVIDER_CAPABILITIES);
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;

export const ProviderCapabilityParamSchema = z.object({ capability: ProviderCapabilitySchema });

/** A saved key as the admin sees it: never the key itself, only its last four characters. */
export const ProviderKeySchema = z.object({
  capability: ProviderCapabilitySchema,
  provider: z.string(),
  last4: z.string(),
  updatedAt: z.string(),
});
export type ProviderKey = z.infer<typeof ProviderKeySchema>;

export const ProviderKeyListSchema = z.object({
  items: z.array(ProviderKeySchema),
  /** Providers a key may be saved for, per capability. */
  providers: z.object({ AI: z.array(z.string()), VOICE: z.array(z.string()) }),
  /** False when the server has no master key: keys cannot be stored. */
  secretsConfigured: z.boolean(),
});
export type ProviderKeyList = z.infer<typeof ProviderKeyListSchema>;

/** A pasted provider key: printable, no spaces, and a sane length. */
export const SaveProviderKeySchema = z.object({
  provider: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  apiKey: z
    .string()
    .trim()
    .min(20, 'That key looks too short')
    .max(400)
    .regex(/^[\x21-\x7e]+$/, 'A key has no spaces or special characters'),
});
export type SaveProviderKey = z.infer<typeof SaveProviderKeySchema>;
