import type {
  CustomerField,
  UpdateWorkspaceSettings,
  WorkspaceSettings,
  WorkspaceSettingsStatus,
} from '@bookleaf/shared';
import type { AiRuntime } from '../../ai/jobs/runtime.js';
import type { Db } from '../../platform/db.js';
import { ValidationError } from '../../platform/errors.js';
import type { PlanReader } from '../platform/plans.js';
import type { WorkspaceConfigs } from './configs.js';
import type { EmbedOrigins } from './embed-origins.js';
import type { Session } from '../auth/session.js';
import {
  createField,
  deleteField,
  listFields,
  toFieldDto,
  updateField,
  type FieldInput,
} from './fields.js';
import { assertWithinPlan } from './plan-caps.js';
import {
  loadWorkspaceSettings,
  toSettingsDto,
  updateWorkspaceSettings,
} from './workspace-settings.js';

export interface SettingsDeps {
  db: Db;
  ai: AiRuntime;
  voiceConfigured: (workspaceId: string) => Promise<boolean>;
  /** The approved voices: the platform voice provider's (empty without one). */
  voices: readonly string[];
  configs: WorkspaceConfigs;
  plans: PlanReader;
  /** Allowed origins feed the widget's frame list: refreshed after a save. */
  embedOrigins: EmbedOrigins;
}

/** A chosen voice must be one of the approved voices. */
function assertAllowedVoice(deps: SettingsDeps, input: UpdateWorkspaceSettings) {
  const name = input.voiceName;
  if (name === undefined || deps.voices.length === 0 || deps.voices.includes(name)) return;
  throw new ValidationError('Invalid workspace settings', [
    { path: 'voiceName', message: 'Voice is not one the voice provider offers' },
  ]);
}

async function aiConfigured(ai: AiRuntime): Promise<boolean> {
  const { provider } = await ai.settings();
  return (await ai.configuredProviders([provider])).length > 0;
}

/**
 * Per-workspace AI behaviour, chat, voice and widget settings, plus the customer-data schema.
 * Providers, models and keys are the support provider's (U-7); the plan caps the rest.
 */
export function createSettingsService(deps: SettingsDeps) {
  const { db, configs } = deps;
  return {
    async status(session: Session): Promise<WorkspaceSettingsStatus> {
      const ws = session.workspaceId;
      const [row, { plan }, voiceConfigured, configured] = await Promise.all([
        loadWorkspaceSettings(db, ws, configs.seed),
        deps.plans.forWorkspace(ws),
        deps.voiceConfigured(ws),
        aiConfigured(deps.ai),
      ]);
      return {
        settings: toSettingsDto(row),
        plan,
        voiceConfigured,
        voices: [...deps.voices],
        aiConfigured: configured,
      };
    },
    async update(session: Session, input: UpdateWorkspaceSettings): Promise<WorkspaceSettings> {
      assertAllowedVoice(deps, input);
      assertWithinPlan((await deps.plans.forWorkspace(session.workspaceId)).plan, input);
      const row = await updateWorkspaceSettings(db, session, input, configs.seed);
      configs.invalidate(session.workspaceId);
      if (input.allowedOrigins) deps.embedOrigins.invalidate();
      return toSettingsDto(row);
    },

    fields: {
      list: async (s: Session): Promise<{ items: CustomerField[] }> => ({
        items: (await listFields(db, s)).map(toFieldDto),
      }),
      create: async (s: Session, input: FieldInput) => toFieldDto(await createField(db, s, input)),
      update: async (s: Session, id: string, input: FieldInput) =>
        toFieldDto(await updateField(db, s, id, input)),
      remove: (s: Session, id: string) => deleteField(db, s, id),
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
