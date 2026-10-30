import type {
  PlatformAiSettings,
  PlatformAiStatus,
  SavePlatformKey,
  UpdatePlatformAiSettings,
} from '@bookleaf/shared';
import type { ProviderCapability } from '@prisma/client';
import { PROVIDER_CATALOG, findModel } from '../../ai/providers/catalog.js';
import { AiError } from '../../ai/providers/errors.js';
import { ConflictError, NotFoundError, ValidationError } from '../../platform/errors.js';
import { asPlatform } from '../../platform/tenancy.js';
import { SecretsNotConfiguredError } from '../connectors/store.js';
import { platformAiStatus, toPlatformAiSettings, type PlatformAiDeps } from './ai-status.js';
import { removePlatformKey, savePlatformKey } from './keys.js';

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

/** A tiny live call with the triage model on the active key. Vendor error text is never shown. */
async function testConnection(deps: PlatformAiDeps): Promise<{ ok: boolean; detail: string }> {
  const s = await deps.ai.settings();
  const provider = await deps.ai.provider(s.provider);
  if (!provider)
    return { ok: false, detail: 'No API key is saved or configured for this provider' };
  try {
    await provider.ping(s.triageModel);
    return { ok: true, detail: `${s.triageModel} responded` };
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    return { ok: false, detail: `Failed: ${err.code}` };
  }
}

/** The console's AI screen (U-7): platform keys are write-only and shown by their last 4 only. */
export function createPlatformAiAdmin(deps: PlatformAiDeps) {
  let lastTest: PlatformAiStatus['lastTest'] = null;
  return {
    status: () => platformAiStatus(deps, lastTest),
    update: (input: UpdatePlatformAiSettings): Promise<PlatformAiSettings> =>
      updateSettings(deps, input),
    async saveKey(capability: ProviderCapability, provider: string, input: SavePlatformKey) {
      if (!deps.envelope) throw new SecretsNotConfiguredError();
      assertProvider(deps, capability, provider);
      await savePlatformKey(deps.db, deps.envelope, { capability, provider, apiKey: input.apiKey });
      deps.providers.invalidate();
      return platformAiStatus(deps, lastTest);
    },
    async removeKey(capability: ProviderCapability, provider: string): Promise<void> {
      if (!(await removePlatformKey(deps.db, capability, provider)))
        throw new NotFoundError('Provider key');
      deps.providers.invalidate();
    },
    async test() {
      const result = await testConnection(deps);
      lastTest = { ...result, at: deps.clock.now().toISOString() };
      return result;
    },
  };
}

export type PlatformAiAdmin = ReturnType<typeof createPlatformAiAdmin>;
