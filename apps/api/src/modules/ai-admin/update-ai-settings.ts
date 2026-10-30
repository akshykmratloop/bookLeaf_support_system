import type { AiSettings, UpdateAiSettings } from '@bookleaf/shared';
import type { AiSettingsRow } from '../../ai/jobs/runtime.js';
import { PROVIDER_CATALOG, findModel } from '../../ai/providers/catalog.js';
import { ConflictError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { toAiSettingsDto, type AiAdminDeps } from './deps.js';

type Choice = Pick<AiSettingsRow, 'provider' | 'triageModel' | 'draftModel'>;
type FieldError = { path: string; message: string };

function providerError(provider: string, configured: string[]): FieldError | null {
  if (!PROVIDER_CATALOG.some((p) => p.id === provider))
    return { path: 'provider', message: 'Unknown provider' };
  if (!configured.includes(provider))
    return { path: 'provider', message: 'This provider has no API key configured on the server' };
  return null;
}

function validateChoice(next: Choice, configured: string[]): void {
  const errors: FieldError[] = [];
  const provider = providerError(next.provider, configured);
  if (provider) errors.push(provider);
  if (!findModel(next.provider, next.triageModel))
    errors.push({ path: 'triageModel', message: 'Model is not in the allowed list' });
  if (!findModel(next.provider, next.draftModel))
    errors.push({ path: 'draftModel', message: 'Model is not in the allowed list' });
  if (errors.length) throw new ValidationError('Invalid AI settings', errors);
}

/** Provider/model choice lives in the DB (editable in the UI); API keys stay in env. */
export async function updateAiSettings(
  { db, ai }: AiAdminDeps,
  session: Session,
  input: UpdateAiSettings,
): Promise<AiSettings> {
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
  const res = await db.aiSettings.updateMany({ where: { id: 1, version: input.version }, data });
  if (res.count === 0)
    throw new ConflictError(
      'VERSION_CONFLICT',
      'AI settings were changed by someone else. Reload and try again.',
    );
  await db.auditEvent.create({
    data: {
      // Recorded in the acting admin's workspace: row-level security allows no other (S.8).
      workspaceId: session.workspaceId,
      actorId: session.userId,
      entityType: 'ai_settings',
      entityId: '1',
      action: 'ai_settings.updated',
      before: toAiSettingsDto(current),
      after: data,
    },
  });
  ai.invalidate();
  return toAiSettingsDto(await ai.settings());
}
