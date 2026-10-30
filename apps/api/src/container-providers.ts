import { createAiRuntime, type AiRuntime } from './ai/jobs/runtime.js';
import { buildProviderRegistry } from './ai/providers/registry.js';
import type { LlmProvider } from './ai/providers/types.js';
import type { Env } from './config/index.js';
import { envelopeFromEnv } from './modules/connectors/from-env.js';
import { createKeyedProviders } from './modules/provider-keys/keyed.js';
import type { Clock } from './platform/clock.js';
import type { Db } from './platform/db.js';
import type { CacheSync } from './platform/shared-state/cache-sync.js';
import { buildVoiceProvider, voiceProviderFor } from './voice/providers/registry.js';
import type { VoiceProvider } from './voice/providers/types.js';

export interface ProviderOverrides {
  providers?: Map<string, LlmProvider>;
  /** null = no voice provider configured. */
  voiceProvider?: VoiceProvider | null;
  /** Builds a client from a workspace's own AI key (tests pass a fake). */
  buildAi?: (providerId: string, apiKey: string) => LlmProvider | undefined;
  /** Builds a client from a workspace's own voice key (tests pass a fake). */
  buildVoice?: (providerId: string, apiKey: string) => VoiceProvider | null;
}

interface ProviderInputs {
  env: Env;
  db: Db;
  clock: Clock;
  cacheSync: CacheSync;
}

/** AI and voice clients: the platform's from env, and each workspace's own from its saved keys. */
export function createProviders(
  { env, db, clock, cacheSync }: ProviderInputs,
  overrides: ProviderOverrides,
) {
  const providers =
    overrides.providers ?? buildProviderRegistry({ anthropicApiKey: env.ANTHROPIC_API_KEY });
  const voiceProvider =
    overrides.voiceProvider === undefined ? buildVoiceProvider(env) : overrides.voiceProvider;
  const envelope = envelopeFromEnv(env);
  // Saved keys and AI settings are cached per copy and cleared on every copy on save (F-19).
  const keyed = cacheSync.shared(
    'provider-keys',
    createKeyedProviders({
      db,
      envelope,
      now: () => clock.now(),
      platformAi: providers,
      platformVoice: voiceProvider,
      buildAi:
        overrides.buildAi ?? ((id, key) => buildProviderRegistry({ anthropicApiKey: key }).get(id)),
      buildVoice: overrides.buildVoice ?? ((id, key) => voiceProviderFor(env, id, key)),
    }),
  );
  const ai: AiRuntime = cacheSync.shared(
    'ai-settings',
    createAiRuntime(db, providers, () => clock.now(), keyed.ai),
  );
  return { voiceProvider, envelope, keyed, ai };
}
