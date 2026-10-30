import { createAiRuntime, type AiRuntime } from './ai/jobs/runtime.js';
import { buildProviderRegistry } from './ai/providers/registry.js';
import type { LlmProvider } from './ai/providers/types.js';
import type { Env } from './config/index.js';
import { envelopeFromEnv } from './modules/connectors/from-env.js';
import { createPlanReader } from './modules/platform/plans.js';
import { createPlatformProviders } from './modules/platform/providers.js';
import type { Clock } from './platform/clock.js';
import type { Db } from './platform/db.js';
import type { CacheSync } from './platform/shared-state/cache-sync.js';
import type { SharedStateLog } from './platform/shared-state/types.js';
import { buildVoiceProvider, voiceProviderFor } from './voice/providers/registry.js';
import type { VoiceProvider } from './voice/providers/types.js';

export interface ProviderOverrides {
  /** The AI clients the env keys would give (tests pass a fake). */
  providers?: Map<string, LlmProvider>;
  /** null = no voice provider configured. */
  voiceProvider?: VoiceProvider | null;
  /** Builds a client from a key saved in the console (tests pass a fake). */
  buildAi?: (providerId: string, apiKey: string) => LlmProvider | undefined;
  /** Builds a voice client from a saved key (tests pass a fake). */
  buildVoice?: (providerId: string, apiKey: string) => VoiceProvider | null;
}

interface ProviderInputs {
  env: Env;
  db: Db;
  clock: Clock;
  cacheSync: CacheSync;
  log: SharedStateLog;
}

/**
 * AI and voice clients every customer runs on (U-7): a key saved in the console, else the env
 * key. Plans and settings are cached per copy and cleared on every copy on save (F-19).
 */
export function createProviders(
  { env, db, clock, cacheSync, log }: ProviderInputs,
  overrides: ProviderOverrides,
) {
  const envAi =
    overrides.providers ?? buildProviderRegistry({ anthropicApiKey: env.ANTHROPIC_API_KEY });
  const voiceProvider =
    overrides.voiceProvider === undefined ? buildVoiceProvider(env) : overrides.voiceProvider;
  const envelope = envelopeFromEnv(env);
  const buildVoice = overrides.buildVoice;
  const platform = cacheSync.shared(
    'platform-providers',
    createPlatformProviders({
      db,
      envelope,
      now: () => clock.now(),
      log,
      envAi,
      envVoice: voiceProvider,
      envVoiceKey: env.OPENAI_API_KEY,
      voiceProviderId: env.VOICE_PROVIDER,
      buildAi:
        overrides.buildAi ?? ((id, key) => buildProviderRegistry({ anthropicApiKey: key }).get(id)),
      buildVoice: buildVoice
        ? (id, key) => buildVoice(id, key)
        : (id, key, model) => voiceProviderFor(env, id, key, model),
    }),
  );
  const plans = cacheSync.shared('workspace-plans', createPlanReader(db));
  const ai: AiRuntime = cacheSync.shared(
    'ai-settings',
    createAiRuntime({
      db,
      now: () => clock.now(),
      provider: (id) => platform.ai(id),
      aiAllowed: async (workspaceId) => (await plans.forWorkspace(workspaceId)).plan.aiEnabled,
    }),
  );
  return { voiceProvider, envAi, envelope, platform, plans, ai };
}
