import { z } from 'zod';
import { flag } from './fields.js';

/**
 * Platform-wide settings of the multi-tenant product. Tenant settings never live here: they
 * are rows a workspace edits in the UI.
 */
export const PlatformConfig = z.object({
  /**
   * Master key for envelope encryption of per-workspace secrets: base64 of at least 32 random
   * bytes (`openssl rand -base64 32`). Required in production; without it, saving a connector
   * is refused and only the env-seeded default workspace can fetch customer data.
   */
  SECRETS_MASTER_KEY: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || Buffer.from(v, 'base64').length >= 32, {
      message: 'SECRETS_MASTER_KEY must be base64 of at least 32 bytes',
    }),
  /** Previous master key, kept while rotating so older values still decrypt. */
  SECRETS_MASTER_KEY_PREVIOUS: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  /** Development only: let connector URLs point at localhost or private networks. */
  CONNECTOR_ALLOW_PRIVATE_HOSTS: flag('false'),
  /** Self-serve signups a single address may make per hour. */
  SIGNUPS_PER_HOUR: z.coerce.number().int().min(1).max(100).default(5),
});
