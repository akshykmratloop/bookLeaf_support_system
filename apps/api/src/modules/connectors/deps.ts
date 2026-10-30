import type { Clock } from '../../platform/clock.js';
import type { Envelope } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import type { RecordMapping } from '@bookleaf/shared';
import type { SourceSpec } from '../../host/sources/types.js';
import type { SsrfPolicy } from '../../platform/net/ssrf.js';

/** Plain (decrypted) connector settings, as the host adapter needs them. */
export interface ConnectorConfig {
  /** The older single-endpoint base URL, kept until the column is dropped (§17). */
  baseUrl: string | null;
  signInUrl: string | null;
  apiKey: string;
  signingSecret: string;
  timeoutMs: number;
  cacheSeconds: number;
  /** U-9: one to five data sources, in order. */
  sources: SourceSpec[];
  /** U-9: where name, email and the item list come from in MAPPED sources. */
  record: RecordMapping;
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
