import type {
  KeySource,
  PlatformAiSettings,
  PlatformAiStatus,
  PlatformProvider,
} from '@bookleaf/shared';
import type { PlatformProviderKey, ProviderCapability } from '@prisma/client';
import type { AiRuntime, AiSettingsRow } from '../../ai/jobs/runtime.js';
import { PROVIDER_CATALOG } from '../../ai/providers/catalog.js';
import type { LlmProvider } from '../../ai/providers/types.js';
import type { Clock } from '../../platform/clock.js';
import type { Envelope } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import { voiceModelsFor } from '../../voice/providers/registry.js';
import { recentAiJobOutcomes } from './ai-outages.js';
import type { PlanReader } from './plans.js';
import type { PlatformProviders } from './providers.js';

/** What the console's AI screens need. */
export interface PlatformAiDeps {
  db: Db;
  clock: Clock;
  ai: AiRuntime;
  providers: PlatformProviders;
  plans: PlanReader;
  envelope: Envelope | null;
  /** Clients built from the server's env keys (for "key from env"). */
  envAi: ReadonlyMap<string, LlmProvider>;
  /** The voice provider ids, and the one the env has a key for (null: none). */
  voiceProviderIds: readonly string[];
  envVoiceProvider: string | null;
  defaultVoiceModel: string;
}

export const toPlatformAiSettings = (s: AiSettingsRow): PlatformAiSettings => ({
  provider: s.provider,
  triageModel: s.triageModel,
  draftModel: s.draftModel,
  chatModel: s.chatModel,
  voiceModel: s.voiceModel,
  simulateOutage: s.simulateOutage,
  version: s.version,
  updatedAt: s.updatedAt.toISOString(),
});

function sourceOf(saved: PlatformProviderKey | undefined, inEnv: boolean): KeySource {
  if (saved) return 'SAVED';
  return inEnv ? 'ENV' : 'NONE';
}

function providerRows(deps: PlatformAiDeps, saved: PlatformProviderKey[]): PlatformProvider[] {
  const find = (capability: ProviderCapability, id: string) =>
    saved.find((k) => k.capability === capability && k.provider === id);
  const ai = PROVIDER_CATALOG.map((p) => {
    const key = find('AI', p.id);
    return {
      capability: 'AI' as const,
      id: p.id,
      label: p.label,
      keySource: sourceOf(key, deps.envAi.has(p.id)),
      last4: key?.last4 ?? null,
      models: p.models.map((m) => ({ id: m.id, label: m.label, tier: m.tier })),
    };
  });
  const voice = deps.voiceProviderIds.map((id) => {
    const key = find('VOICE', id);
    return {
      capability: 'VOICE' as const,
      id,
      label: id === 'openai' ? 'OpenAI Realtime (voice)' : id,
      keySource: sourceOf(key, deps.envVoiceProvider === id),
      last4: key?.last4 ?? null,
      models: voiceModelsFor(id).map((m) => ({ id: m.id, label: m.label, tier: m.tier })),
    };
  });
  return [...ai, ...voice];
}

/** The console's AI screen: settings, each provider's key source (never a key), last test, recent outages. */
export async function platformAiStatus(
  deps: PlatformAiDeps,
  lastTest: PlatformAiStatus['lastTest'],
): Promise<PlatformAiStatus> {
  const [settings, saved, recentJobs] = await Promise.all([
    deps.ai.settings(),
    deps.providers.savedKeys(),
    recentAiJobOutcomes(deps.db, deps.clock.now()),
  ]);
  return {
    settings: toPlatformAiSettings(settings),
    providers: providerRows(deps, saved),
    defaultVoiceModel: deps.defaultVoiceModel,
    secretsConfigured: deps.envelope !== null,
    lastTest,
    recentJobs,
  };
}
