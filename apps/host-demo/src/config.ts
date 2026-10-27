import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** Settings for the demo BookLeaf product. HOST_* values are shared with the support module. */
const ConfigSchema = z.object({
  HOST_DEMO_PORT: z.coerce.number().int().min(1).max(65535).default(3200),
  /** Where the support module runs; the demo page links to it and loads its widget. */
  SUPPORT_URL: z.url().default('http://localhost:3100'),
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
  /** Password for every demo author account. */
  HOST_DEMO_PASSWORD: z.string().min(8).default('Author@BookLeaf1'),
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
