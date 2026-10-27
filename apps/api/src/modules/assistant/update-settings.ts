import type { AssistantSettings, UpdateAssistantSettings } from '@bookleaf/shared';
import { findModel } from '../../ai/providers/catalog.js';
import { ConflictError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { loadSettings, toSettingsDto, type AssistantDeps } from './deps.js';

async function assertAllowedModel(deps: AssistantDeps, chatModel: string | undefined) {
  if (chatModel === undefined) return;
  const ai$ = await deps.ai.settings();
  if (!findModel(ai$.provider, chatModel))
    throw new ValidationError('Invalid assistant settings', [
      { path: 'chatModel', message: 'Model is not in the allowed list for the active provider' },
    ]);
}

/** Switches chat or voice on or off, or picks the chat model. Stale versions conflict. */
export async function updateSettings(
  deps: AssistantDeps,
  session: Session,
  input: UpdateAssistantSettings,
): Promise<AssistantSettings> {
  const current = await loadSettings(deps.db);
  await assertAllowedModel(deps, input.chatModel);
  const data = {
    chatEnabled: input.chatEnabled ?? current.chatEnabled,
    voiceEnabled: input.voiceEnabled ?? current.voiceEnabled,
    chatModel: input.chatModel ?? current.chatModel,
    updatedById: session.userId,
  };
  // The change and its audit record commit together, or neither does.
  await deps.db.$transaction(async (tx) => {
    const res = await tx.assistantSettings.updateMany({
      where: { id: 1, version: input.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (res.count === 0)
      throw new ConflictError(
        'VERSION_CONFLICT',
        'Assistant settings were changed by someone else. Reload and try again.',
      );
    await tx.auditEvent.create({
      data: {
        actorId: session.userId,
        entityType: 'assistant_settings',
        entityId: '1',
        action: 'assistant_settings.updated',
        before: toSettingsDto(current),
        after: data,
      },
    });
  });
  return toSettingsDto(await loadSettings(deps.db));
}
