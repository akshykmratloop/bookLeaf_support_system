import type { Clock } from '../../platform/clock.js';
import type { Envelope } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import type { SsrfPolicy } from '../../platform/net/ssrf.js';

/** Plain (decrypted) connector settings, as the HTTP host adapter needs them. */
export interface ConnectorConfig {
  baseUrl: string;
  signInUrl: string | null;
  apiKey: string;
  signingSecret: string;
  timeoutMs: number;
  cacheSeconds: number;
}

/** What the connector module needs from the rest of the app. */
export interface ConnectorDeps {
  db: Db;
  clock: Clock;
  /** Null when SECRETS_MASTER_KEY is unset: saving a connector is then refused. */
  envelope: Envelope | null;
  ssrf: SsrfPolicy;
  /** The default workspace's settings from env, used while it has no connector row. */
  envDefaults: ConnectorConfig | null;
}

/** AAD binds each ciphertext to its row and field (see platform/crypto/envelope.ts). */
export const aadFor = (workspaceId: string, field: 'apiKey' | 'signingSecret') =>
  `connector:${workspaceId}:${field}`;
