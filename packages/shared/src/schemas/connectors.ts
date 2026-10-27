import { z } from 'zod';

/**
 * How a workspace's customer data is fetched from its own product: the base URL of the
 * `GET /support/customers/{id}` endpoint, the Bearer key we send, and the HS256 secret that
 * signs the product's sign-in tokens. Secrets are write-only: the API returns a hint only.
 */
const secret = (min: number) => z.string().trim().min(min).max(512);

export const SaveConnectorRequestSchema = z
  .object({
    version: z.int().min(0),
    baseUrl: z.url().max(2048),
    signInUrl: z.url().max(2048).nullable().optional(),
    /** Omit to keep the stored value; required the first time. */
    apiKey: secret(24).optional(),
    signingSecret: secret(32).optional(),
    timeoutMs: z.int().min(200).max(10_000).optional(),
    cacheSeconds: z.int().min(0).max(600).optional(),
  })
  .strict();
export type SaveConnectorRequest = z.infer<typeof SaveConnectorRequestSchema>;

/** A stored secret as the UI sees it: never the value. */
export const SecretHintSchema = z.object({ hint: z.string(), updatedAt: z.iso.datetime() });

export const ConnectorSchema = z.object({
  /** False for the default workspace while it still runs on env settings. */
  configured: z.boolean(),
  /** Where the settings come from: a saved row, or env for the seeded default workspace. */
  source: z.enum(['WORKSPACE', 'ENV', 'NONE']),
  baseUrl: z.string().nullable(),
  signInUrl: z.string().nullable(),
  apiKey: SecretHintSchema.nullable(),
  signingSecret: SecretHintSchema.nullable(),
  timeoutMs: z.int(),
  cacheSeconds: z.int(),
  lastTest: z.object({ ok: z.boolean(), at: z.iso.datetime(), detail: z.string() }).nullable(),
  version: z.int(),
});
export type Connector = z.infer<typeof ConnectorSchema>;

export const ConnectorTestRequestSchema = z.object({
  /** A customer id the product knows, used to try the endpoint end to end. */
  customerId: z.string().trim().min(1).max(100),
});

export const ConnectorTestResultSchema = z.object({
  ok: z.boolean(),
  detail: z.string(),
  /** On success: how many facts and items the product returned for the sample customer. */
  facts: z.int().optional(),
  items: z.int().optional(),
});
export type ConnectorTestResult = z.infer<typeof ConnectorTestResultSchema>;
