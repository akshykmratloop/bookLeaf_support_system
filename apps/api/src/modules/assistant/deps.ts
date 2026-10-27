import type { AssistantSettings } from '@bookleaf/shared';
import type { AssistantSettings as SettingsRow } from '@prisma/client';
import type { AiRuntime } from '../../ai/jobs/runtime.js';
import type { Db } from '../../platform/db.js';
import type { AssistantLimits } from './limits.js';

/** What the assistant switches need from the rest of the app. */
export interface AssistantDeps {
  db: Db;
  ai: AiRuntime;
  limits: AssistantLimits;
  /** True when the server holds a credential for the realtime voice provider. */
  voiceConfigured: boolean;
}

/** The single settings row, created with both switches off on first read. */
export const loadSettings = (db: Db) =>
  db.assistantSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

export const toSettingsDto = (s: SettingsRow): AssistantSettings => ({
  chatEnabled: s.chatEnabled,
  voiceEnabled: s.voiceEnabled,
  chatModel: s.chatModel,
  version: s.version,
  updatedAt: s.updatedAt.toISOString(),
});
