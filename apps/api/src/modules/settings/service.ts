import type {
  CustomerField,
  UpdateWorkspaceSettings,
  WorkspaceSettings,
  WorkspaceSettingsStatus,
} from '@bookleaf/shared';
import type { AiRuntime } from '../../ai/jobs/runtime.js';
import { PROVIDER_CATALOG, findModel } from '../../ai/providers/catalog.js';
import type { Db } from '../../platform/db.js';
import { ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import {
  createField,
  deleteField,
  listFields,
  toFieldDto,
  updateField,
  type FieldInput,
} from './fields.js';
import {
  loadWorkspaceSettings,
  toSettingsDto,
  updateWorkspaceSettings,
} from './workspace-settings.js';

export interface SettingsDeps {
  db: Db;
  ai: AiRuntime;
  voiceConfigured: boolean;
}

const MODEL_FIELDS = ['triageModel', 'draftModel', 'chatModel'] as const;

/** A chosen model must belong to the active provider's allowlist (null = platform default). */
async function assertAllowedModels(deps: SettingsDeps, input: UpdateWorkspaceSettings) {
  const { provider } = await deps.ai.settings();
  const errors = MODEL_FIELDS.filter((f) => {
    const model = input[f];
    return typeof model === 'string' && !findModel(provider, model);
  }).map((path) => ({ path, message: 'Model is not in the allowed list for the active provider' }));
  if (errors.length) throw new ValidationError('Invalid workspace settings', errors);
}

/** Per-workspace assistant, chat, voice and widget settings, plus the customer-data schema. */
export function createSettingsService(deps: SettingsDeps) {
  const { db } = deps;
  return {
    async status(session: Session): Promise<WorkspaceSettingsStatus> {
      const [row, ai$] = await Promise.all([
        loadWorkspaceSettings(db, session.workspaceId),
        deps.ai.settings(),
      ]);
      const provider = PROVIDER_CATALOG.find((p) => p.id === ai$.provider);
      return {
        settings: toSettingsDto(row),
        models: (provider?.models ?? []).map((m) => ({ id: m.id, label: m.label, tier: m.tier })),
        voiceConfigured: deps.voiceConfigured,
        aiConfigured: deps.ai.configuredProviders().includes(ai$.provider),
      };
    },
    async update(session: Session, input: UpdateWorkspaceSettings): Promise<WorkspaceSettings> {
      await assertAllowedModels(deps, input);
      return toSettingsDto(await updateWorkspaceSettings(db, session, input));
    },
    /** Effective settings for a workspace, for readers outside the admin screen. */
    forWorkspace: async (workspaceId: string): Promise<WorkspaceSettings> =>
      toSettingsDto(await loadWorkspaceSettings(db, workspaceId)),

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
