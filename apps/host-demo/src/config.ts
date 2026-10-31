import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** Settings for the demo BookLeaf product. HOST_* values are shared with the support module. */
const ConfigSchema = z.object({
  HOST_DEMO_PORT: z.coerce.number().int().min(1).max(65535).default(3200),
  /** Where the support module runs; the demo page links to it and loads its widget. */
  SUPPORT_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:3100'),
  /** BookLeaf's workspace in the support module: the widget opens `/embed/<this>`. */
  SUPPORT_WORKSPACE: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, 'must be a workspace address name')
    .default('bookleaf'),
  /** The support module sends this as a Bearer token to read customer data. */
  HOST_API_KEY: z.string().min(24, 'HOST_API_KEY must be at least 24 characters'),
  /** Signs the hand-over tokens the support module accepts. */
  HOST_SIGNING_SECRET: z.string().min(32, 'HOST_SIGNING_SECRET must be at least 32 characters'),
  /** Business clock: royalty and payout maths run "as of" this date. */
  DATA_AS_OF: z.iso.date().default('2025-12-31'),
  /** The built author dashboard (apps/host-web). Default: that app's dist folder. */
  HOST_WEB_DIST: z
    .string()
    .min(1)
    .default(fileURLToPath(new URL('../../host-web/dist', import.meta.url))),
  /**
   * Password for every demo author account. Required, no default: production sets it from the
   * secret store, local runs from .env (scripts/local/env.mjs copies .env.example's demo value).
   */
  HOST_DEMO_PASSWORD: z
    .string()
    .min(12, 'HOST_DEMO_PASSWORD must be at least 12 characters')
    .max(128),
  /**
   * Behind the deploy's reverse proxy: take the client address from X-Forwarded-For, so sign-in
   * limits count per visitor and not per proxy. Off locally, where nothing sets that header.
   */
  HOST_TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Session cookie only over HTTPS. On when deployed behind TLS; off for plain-HTTP local runs. */
  HOST_SECURE_COOKIES: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type HostConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): HostConfig {
  const parsed = ConfigSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration — ${issues}`);
  }
  return parsed.data;
}
