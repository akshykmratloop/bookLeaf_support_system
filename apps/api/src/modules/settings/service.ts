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
import {
  loadWorkspaceSettings,
  toSettingsDto,
  updateWorkspaceSettings,
} from './workspace-settings.js';

export interface SettingsDeps {
  db: Db;
  ai: AiRuntime;
  voiceConfigured: (workspaceId: string) => Promise<boolean>;
  /** Voice names the platform's voice provider speaks with (empty without one). */
  voices: readonly string[];
  configs: WorkspaceConfigs;
  /** Allowed origins feed the widget's frame list: refreshed after a save. */
  embedOrigins: EmbedOrigins;
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

/** A chosen voice must be one the platform's voice provider has. */
function assertAllowedVoice(deps: SettingsDeps, input: UpdateWorkspaceSettings) {
  const name = input.voiceName;
  if (name === undefined || deps.voices.length === 0 || deps.voices.includes(name)) return;
  throw new ValidationError('Invalid workspace settings', [
    { path: 'voiceName', message: 'Voice is not one the voice provider offers' },
  ]);
}

/** Per-workspace assistant, chat, voice and widget settings, plus the customer-data schema. */
export function createSettingsService(deps: SettingsDeps) {
  const { db, configs } = deps;
  return {
    async status(session: Session): Promise<WorkspaceSettingsStatus> {
      const [row, ai$] = await Promise.all([
        loadWorkspaceSettings(db, session.workspaceId, configs.seed),
        deps.ai.settings(),
      ]);
      const provider = PROVIDER_CATALOG.find((p) => p.id === ai$.provider);
      return {
        settings: toSettingsDto(row),
        models: (provider?.models ?? []).map((m) => ({ id: m.id, label: m.label, tier: m.tier })),
        voiceConfigured: await deps.voiceConfigured(session.workspaceId),
        voices: [...deps.voices],
        aiConfigured: deps.ai.configuredProviders().includes(ai$.provider),
      };
    },
    async update(session: Session, input: UpdateWorkspaceSettings): Promise<WorkspaceSettings> {
      assertAllowedVoice(deps, input);
      await assertAllowedModels(deps, input);
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
