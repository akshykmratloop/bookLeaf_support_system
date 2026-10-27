import { z } from 'zod';
import { int } from './fields.js';

/**
 * The product this support module is attached to (the "host"). Customer data is read only
 * from the host, over HTTP; see docs/integration.md for the contract.
 */
export const HostConfig = z.object({
  /** Base URL of the host's API; the module calls `${HOST_API_URL}/support/customers/{id}`. */
  HOST_API_URL: z.url(),
  /** Sent to the host as `Authorization: Bearer …`. */
  HOST_API_KEY: z.string().min(24, 'HOST_API_KEY must be at least 24 characters'),
  /** Verifies the host's hand-over tokens (HS256). */
  HOST_SIGNING_SECRET: z.string().min(32, 'HOST_SIGNING_SECRET must be at least 32 characters'),
  /** Where authors sign in on the host; the support login page links there. */
  HOST_SIGN_IN_URL: z.url().optional(),
  HOST_TIMEOUT_MS: int(200, 10_000, 3000),
  /** How long a customer's data is reused before asking the host again. */
  HOST_CACHE_SECONDS: int(0, 600, 60),
});
