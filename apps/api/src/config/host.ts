import { z } from 'zod';
import { flag, int } from './fields.js';

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
  /**
   * Comma-separated origins allowed to show the support widget in an iframe (embed mode),
   * e.g. `https://app.bookleaf.in`. Empty: the widget cannot be framed.
   */
  HOST_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url().transform((u) => new URL(u).origin)).max(10)),
  /**
   * Embed mode without HOST_ORIGINS: workspaces' own allowed origins may frame the widget, and the
   * session cookie works inside the iframe. Always on when HOST_ORIGINS is set.
   */
  EMBED_ENABLED: flag('false'),
  HOST_TIMEOUT_MS: int(200, 10_000, 3000),
  /** How long a customer's data is reused before asking the host again. */
  HOST_CACHE_SECONDS: int(0, 600, 60),
});
