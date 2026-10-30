import type { AssistantSettings } from '@bookleaf/shared';
import type { WorkspaceSettings as WorkspaceRow } from '@prisma/client';
import type { AiRuntime } from '../../ai/jobs/runtime.js';
import type { Db } from '../../platform/db.js';
import type { PlanReader } from '../platform/plans.js';
import type { WorkspaceConfigs } from '../settings/configs.js';

/** What the assistant switches need from the rest of the app. */
export interface AssistantDeps {
  db: Db;
  ai: AiRuntime;
  /** Each workspace's switches and limits, within its plan. */
  configs: WorkspaceConfigs;
  plans: PlanReader;
  /** True when the platform has a usable voice provider. */
  voiceConfigured: (workspaceId: string) => Promise<boolean>;
}

/** The "Author Assistant" screen's view of a workspace's settings row. */
export const toSettingsDto = (s: WorkspaceRow): AssistantSettings => ({
  chatEnabled: s.chatEnabled,
  voiceEnabled: s.voiceEnabled,
  version: s.version,
  updatedAt: s.updatedAt.toISOString(),
});
