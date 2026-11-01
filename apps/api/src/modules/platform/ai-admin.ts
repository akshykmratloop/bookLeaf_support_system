import type {
  PlatformAiSettings,
  SavePlatformKey,
  UpdatePlatformAiSettings,
} from '@bookleaf/shared';
import type { ProviderCapability } from '@prisma/client';
import { PROVIDER_CATALOG, findModel } from '../../ai/providers/catalog.js';
import { ConflictError, NotFoundError, ValidationError } from '../../platform/errors.js';
import { asPlatform } from '../../platform/tenancy.js';
import { SecretsNotConfiguredError } from '../connectors/store.js';
import { platformAiStatus, toPlatformAiSettings, type PlatformAiDeps } from './ai-status.js';
import { removePlatformKey, savePlatformKey } from './keys.js';
import { testConnections } from './connection-tests.js';
import { readLastTests, saveLastTests } from './last-test.js';

type FieldError = { path: string; message: string };
const MODEL_FIELDS = ['triageModel', 'draftModel', 'chatModel'] as const;

function choiceErrors(next: Record<(typeof MODEL_FIELDS)[number] | 'provider', string>) {
  const errors: FieldError[] = [];
  if (!PROVIDER_CATALOG.some((p) => p.id === next.provider))
    errors.push({ path: 'provider', message: 'Unknown provider' });
  for (const f of MODEL_FIELDS)
    if (!findModel(next.provider, next[f]))
      errors.push({ path: f, message: 'Model is not in the allowed list for this provider' });
  return errors;
}

/** Provider, models, voice model and the outage switch, for every customer at once. */
async function updateSettings(deps: PlatformAiDeps, input: UpdatePlatformAiSettings) {
  const current = await deps.ai.settings();
  const { version, ...changes } = input;
  const next = {
    ...current,
    ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)),
  };
  const errors = choiceErrors(next);
  if (errors.length) throw new ValidationError('Invalid AI settings', errors);
  const { provider, triageModel, draftModel, chatModel, voiceModel, simulateOutage } = next;
  const res = await asPlatform(() =>
    deps.db.platformSettings.updateMany({
      where: { id: 1, version },
      data: {
        provider,
        triageModel,
        draftModel,
        chatModel,
        voiceModel,
        simulateOutage,
        version: { increment: 1 },
      },
    }),
  );
  if (res.count === 0)
    throw new ConflictError(
      'VERSION_CONFLICT',
      'AI settings were changed by someone else. Reload and try again.',
    );
  deps.ai.invalidate();
  deps.providers.invalidate();
  return toPlatformAiSettings(await deps.ai.settings());
}

function assertProvider(deps: PlatformAiDeps, capability: ProviderCapability, provider: string) {
  const allowed = capability === 'AI' ? PROVIDER_CATALOG.map((p) => p.id) : deps.voiceProviderIds;
  if (allowed.includes(provider)) return;
  throw new ValidationError('Unknown provider', [
    { path: 'provider', message: `Choose one of: ${allowed.join(', ')}` },
  ]);
}

/** The console's AI screen (U-7): platform keys are write-only and shown by their last 4 only. */
export function createPlatformAiAdmin(deps: PlatformAiDeps) {
  const status = async () => platformAiStatus(deps, await readLastTests(deps.db));
  return {
    status,
    update: (input: UpdatePlatformAiSettings): Promise<PlatformAiSettings> =>
      updateSettings(deps, input),
    async saveKey(capability: ProviderCapability, provider: string, input: SavePlatformKey) {
      if (!deps.envelope) throw new SecretsNotConfiguredError();
      assertProvider(deps, capability, provider);
      await savePlatformKey(deps.db, deps.envelope, { capability, provider, apiKey: input.apiKey });
      deps.providers.invalidate();
      return status();
    },
    async removeKey(capability: ProviderCapability, provider: string): Promise<void> {
      if (!(await removePlatformKey(deps.db, capability, provider)))
        throw new NotFoundError('Provider key');
      deps.providers.invalidate();
    },
    async test() {
      const results = await testConnections(deps);
      await saveLastTests(deps.db, results, deps.clock.now());
      return results;
    },
  };
}

export type PlatformAiAdmin = ReturnType<typeof createPlatformAiAdmin>;
