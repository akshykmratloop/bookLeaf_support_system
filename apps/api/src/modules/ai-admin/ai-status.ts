import type { AiStatus } from '@bookleaf/shared';
import { PROVIDER_CATALOG } from '../../ai/providers/catalog.js';
import { AiError } from '../../ai/providers/errors.js';
import { toAiSettingsDto, type AiAdminDeps } from './deps.js';

export type ProviderTest = { ok: boolean; detail: string };

/** Current choice plus every provider, marked configured when the server holds its key. */
export async function aiStatus(
  { ai }: AiAdminDeps,
  lastTest: AiStatus['lastTest'],
): Promise<AiStatus> {
  const configured = ai.configuredProviders();
  return {
    settings: toAiSettingsDto(await ai.settings()),
    providers: PROVIDER_CATALOG.map((p) => ({
      id: p.id,
      label: p.label,
      configured: configured.includes(p.id),
      models: p.models.map((m) => ({ id: m.id, label: m.label, tier: m.tier })),
    })),
    lastTest,
  };
}

/** A tiny live call with the configured triage model. Vendor error text is never returned. */
export async function testProvider({ ai }: AiAdminDeps): Promise<ProviderTest> {
  const s = await ai.settings();
  const provider = ai.providerById(s.provider);
  if (!provider)
    return { ok: false, detail: 'No API key is configured for this provider on the server' };
  try {
    await provider.ping(s.triageModel);
    return { ok: true, detail: `${s.triageModel} responded` };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof AiError ? `Failed: ${err.code}` : 'Failed: unexpected error',
    };
  }
}
