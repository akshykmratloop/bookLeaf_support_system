import type { Env } from '../../config/index.js';
import type { Clock } from '../../platform/clock.js';
import { createEnvelope, parseMasterKey } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import { contractSource } from '../../host/sources/contract.js';
import { EMPTY_RECORD_MAPPING } from '../../host/sources/mapping.js';
import type { ConnectorDeps } from './deps.js';

/** The id of the default workspace's data source while it runs on env settings. */
export const ENV_SOURCE_ID = 'env';

/** Builds the envelope from the master key(s) in env; null when none is configured. */
export function envelopeFromEnv(env: Env) {
  if (!env.SECRETS_MASTER_KEY) return null;
  const keys = [parseMasterKey(env.SECRETS_MASTER_KEY, 'k1')];
  if (env.SECRETS_MASTER_KEY_PREVIOUS)
    keys.push(parseMasterKey(env.SECRETS_MASTER_KEY_PREVIOUS, 'k0'));
  return createEnvelope(keys);
}

/** Outbound calls to customer-supplied URLs (connectors, webhooks) follow one SSRF policy. */
export const ssrfPolicyFromEnv = (env: Env) => ({
  requireHttps: env.NODE_ENV === 'production',
  allowPrivateHosts: env.CONNECTOR_ALLOW_PRIVATE_HOSTS,
});

/** Connector deps from validated env: the master key, the SSRF policy and BookLeaf's defaults. */
export function connectorDepsFromEnv(env: Env, db: Db, clock: Clock): ConnectorDeps {
  const base = {
    baseUrl: env.HOST_API_URL.replace(/\/+$/, ''),
    timeoutMs: env.HOST_TIMEOUT_MS,
    cacheSeconds: env.HOST_CACHE_SECONDS,
  };
  return {
    db,
    clock,
    envelope: envelopeFromEnv(env),
    ssrf: ssrfPolicyFromEnv(env),
    envDefaults: {
      ...base,
      signInUrl: env.HOST_SIGN_IN_URL ?? null,
      apiKey: env.HOST_API_KEY,
      signingSecret: env.HOST_SIGNING_SECRET,
      // The same single endpoint as always, as one fixed-shape data source (U-9).
      sources: [contractSource(ENV_SOURCE_ID, base)],
      record: EMPTY_RECORD_MAPPING,
    },
  };
}
