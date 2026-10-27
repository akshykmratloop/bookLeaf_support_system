import type { Env } from '../../config/index.js';
import type { Clock } from '../../platform/clock.js';
import { createEnvelope, parseMasterKey } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import type { ConnectorDeps } from './deps.js';

/** Builds the envelope from the master key(s) in env; null when none is configured. */
function envelopeFromEnv(env: Env) {
  if (!env.SECRETS_MASTER_KEY) return null;
  const keys = [parseMasterKey(env.SECRETS_MASTER_KEY, 'k1')];
  if (env.SECRETS_MASTER_KEY_PREVIOUS)
    keys.push(parseMasterKey(env.SECRETS_MASTER_KEY_PREVIOUS, 'k0'));
  return createEnvelope(keys);
}

/** Connector deps from validated env: the master key, the SSRF policy and BookLeaf's defaults. */
export function connectorDepsFromEnv(env: Env, db: Db, clock: Clock): ConnectorDeps {
  return {
    db,
    clock,
    envelope: envelopeFromEnv(env),
    ssrf: {
      requireHttps: env.NODE_ENV === 'production',
      allowPrivateHosts: env.CONNECTOR_ALLOW_PRIVATE_HOSTS,
    },
    envDefaults: {
      baseUrl: env.HOST_API_URL.replace(/\/+$/, ''),
      signInUrl: env.HOST_SIGN_IN_URL ?? null,
      apiKey: env.HOST_API_KEY,
      signingSecret: env.HOST_SIGNING_SECRET,
      timeoutMs: env.HOST_TIMEOUT_MS,
      cacheSeconds: env.HOST_CACHE_SECONDS,
    },
  };
}
