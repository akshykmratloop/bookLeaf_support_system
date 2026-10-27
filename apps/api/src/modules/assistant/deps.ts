import type { AssistantSettings } from '@bookleaf/shared';
import type { WorkspaceSettings as WorkspaceRow } from '@prisma/client';
import type { AiRuntime } from '../../ai/jobs/runtime.js';
import type { Db } from '../../platform/db.js';
import type { WorkspaceConfigs } from '../settings/configs.js';

/** What the assistant switches need from the rest of the app. */
export interface AssistantDeps {
  db: Db;
  ai: AiRuntime;
  /** Each workspace's switches, limits and models. */
  configs: WorkspaceConfigs;
  /** True when the server holds a credential for the realtime voice provider. */
  voiceConfigured: boolean;
}

/**
 * The platform's starting switches (both off) and chat model. A workspace copies them into its
 * own settings on first use; after that its owner changes them in the UI.
 */
export const loadSettings = (db: Db) =>
  db.assistantSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

/** The platform's starting switches and chat model, for new workspace settings. */
export async function platformSwitches(db: Db) {
  const s = await loadSettings(db);
  return { chatEnabled: s.chatEnabled, voiceEnabled: s.voiceEnabled, chatModel: s.chatModel };
}

/** The "Author Assistant" screen's view of a workspace's settings row. */
export const toSettingsDto = (s: WorkspaceRow, platformModel: string): AssistantSettings => ({
  chatEnabled: s.chatEnabled,
  voiceEnabled: s.voiceEnabled,
  chatModel: s.chatModel ?? platformModel,
  version: s.version,
  updatedAt: s.updatedAt.toISOString(),
});
