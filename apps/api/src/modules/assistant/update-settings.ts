import type { AssistantSettings, UpdateAssistantSettings } from '@bookleaf/shared';
import type { Session } from '../auth/session.js';
import { assertWithinPlan } from '../settings/plan-caps.js';
import { updateWorkspaceSettings } from '../settings/workspace-settings.js';
import { toSettingsDto, type AssistantDeps } from './deps.js';

/**
 * Switches chat or voice on or off for the admin's own workspace (the same settings the
 * Workspace Settings screen edits), only as far as its plan allows (U-7). Stale versions
 * conflict; the change and its audit record commit together.
 */
export async function updateSettings(
  deps: AssistantDeps,
  session: Session,
  input: UpdateAssistantSettings,
): Promise<AssistantSettings> {
  assertWithinPlan((await deps.plans.forWorkspace(session.workspaceId)).plan, input);
  const row = await updateWorkspaceSettings(deps.db, session, input, deps.configs.seed);
  deps.configs.invalidate(session.workspaceId);
  return toSettingsDto(row);
}
