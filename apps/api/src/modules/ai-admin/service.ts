import type { AiSettings, AiStatus, UpdateAiSettings } from '@bookleaf/shared';
import type { AiRuntime, AiSettingsRow } from '../../ai/jobs/runtime.js';
import { PROVIDER_CATALOG, findModel } from '../../ai/providers/catalog.js';
import { AiError } from '../../ai/providers/errors.js';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { ConflictError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';

interface Deps {
  db: Db;
  ai: AiRuntime;
  clock: Clock;
}

const toDto = (s: AiSettingsRow): AiSettings => ({
  provider: s.provider,
  triageModel: s.triageModel,
  draftModel: s.draftModel,
  simulateOutage: s.simulateOutage,
  version: s.version,
  updatedAt: s.updatedAt.toISOString(),
});

function validateChoice(
  next: Pick<AiSettingsRow, 'provider' | 'triageModel' | 'draftModel'>,
  configured: string[],
): void {
  const errors: { path: string; message: string }[] = [];
  if (!PROVIDER_CATALOG.some((p) => p.id === next.provider))
    errors.push({ path: 'provider', message: 'Unknown provider' });
  else if (!configured.includes(next.provider))
    errors.push({
      path: 'provider',
      message: 'This provider has no API key configured on the server',
    });
  if (!findModel(next.provider, next.triageModel))
    errors.push({ path: 'triageModel', message: 'Model is not in the allowed list' });
  if (!findModel(next.provider, next.draftModel))
    errors.push({ path: 'draftModel', message: 'Model is not in the allowed list' });
  if (errors.length) throw new ValidationError('Invalid AI settings', errors);
}

/** Provider/model choice lives in the DB (editable in the UI); API keys stay in env and are never returned. */
export function createAiAdminService({ db, ai, clock }: Deps) {
  let lastTest: AiStatus['lastTest'] = null;
  return {
    async status(): Promise<AiStatus> {
      const configured = ai.configuredProviders();
      return {
        settings: toDto(await ai.settings()),
        providers: PROVIDER_CATALOG.map((p) => ({
          id: p.id,
          label: p.label,
          configured: configured.includes(p.id),
          models: p.models.map((m) => ({ id: m.id, label: m.label, tier: m.tier })),
        })),
        lastTest,
      };
    },
    async update(session: Session, input: UpdateAiSettings): Promise<AiSettings> {
      const current = await db.aiSettings.findUniqueOrThrow({ where: { id: 1 } });
      const next = {
        provider: input.provider ?? current.provider,
        triageModel: input.triageModel ?? current.triageModel,
        draftModel: input.draftModel ?? current.draftModel,
      };
      validateChoice(next, ai.configuredProviders());
      const data = {
        ...next,
        simulateOutage: input.simulateOutage ?? current.simulateOutage,
        updatedById: session.userId,
        version: { increment: 1 },
      };
      const res = await db.aiSettings.updateMany({
        where: { id: 1, version: input.version },
        data,
      });
      if (res.count === 0)
        throw new ConflictError(
          'VERSION_CONFLICT',
          'AI settings were changed by someone else. Reload and try again.',
        );
      await db.auditEvent.create({
        data: {
          actorId: session.userId,
          entityType: 'ai_settings',
          entityId: '1',
          action: 'ai_settings.updated',
          before: toDto(current),
          after: data,
        },
      });
      ai.invalidate();
      return toDto(await ai.settings());
    },
    /** A tiny live call with the configured triage model. Vendor error text is never returned. */
    async test(): Promise<{ ok: boolean; detail: string }> {
      const s = await ai.settings();
      const provider = ai.providerById(s.provider);
      let result: { ok: boolean; detail: string };
      if (!provider)
        result = { ok: false, detail: 'No API key is configured for this provider on the server' };
      else {
        try {
          await provider.ping(s.triageModel);
          result = { ok: true, detail: `${s.triageModel} responded` };
        } catch (err) {
          result = {
            ok: false,
            detail: err instanceof AiError ? `Failed: ${err.code}` : 'Failed: unexpected error',
          };
        }
      }
      lastTest = { ...result, at: clock.now().toISOString() };
      return result;
    },
  };
}

export type AiAdminService = ReturnType<typeof createAiAdminService>;
