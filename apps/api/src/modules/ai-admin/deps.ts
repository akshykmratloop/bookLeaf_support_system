import type { AiSettings } from '@bookleaf/shared';
import type { AiRuntime, AiSettingsRow } from '../../ai/jobs/runtime.js';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';

/** What the AI admin screen needs from the rest of the app. */
export interface AiAdminDeps {
  db: Db;
  ai: AiRuntime;
  clock: Clock;
}

export const toAiSettingsDto = (s: AiSettingsRow): AiSettings => ({
  provider: s.provider,
  triageModel: s.triageModel,
  draftModel: s.draftModel,
  simulateOutage: s.simulateOutage,
  version: s.version,
  updatedAt: s.updatedAt.toISOString(),
});
