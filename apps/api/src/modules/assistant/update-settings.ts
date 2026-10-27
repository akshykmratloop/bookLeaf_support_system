import type { AssistantSettings, UpdateAssistantSettings } from '@bookleaf/shared';
import { findModel } from '../../ai/providers/catalog.js';
import { ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { updateWorkspaceSettings } from '../settings/workspace-settings.js';
import { loadSettings, toSettingsDto, type AssistantDeps } from './deps.js';

async function assertAllowedModel(deps: AssistantDeps, chatModel: string | undefined) {
  if (chatModel === undefined) return;
  const ai$ = await deps.ai.settings();
  if (!findModel(ai$.provider, chatModel))
    throw new ValidationError('Invalid assistant settings', [
      { path: 'chatModel', message: 'Model is not in the allowed list for the active provider' },
    ]);
}

/**
 * Switches chat or voice on or off, or picks the chat model, for the admin's own workspace (the
 * same settings the Workspace Settings screen edits). Stale versions conflict; the change and its
 * audit record commit together.
 */
export async function updateSettings(
  deps: AssistantDeps,
  session: Session,
  input: UpdateAssistantSettings,
): Promise<AssistantSettings> {
  await assertAllowedModel(deps, input.chatModel);
  const row = await updateWorkspaceSettings(deps.db, session, input, deps.configs.seed);
  deps.configs.invalidate(session.workspaceId);
  return toSettingsDto(row, (await loadSettings(deps.db)).chatModel);
}
