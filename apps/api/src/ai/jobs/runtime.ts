import type { Db } from '../../platform/db.js';
import { AiNotConfiguredError, AiOutageSimulatedError } from '../providers/errors.js';
import { findModel } from '../providers/catalog.js';
import type { LlmProvider } from '../providers/types.js';

export interface AiSettingsRow {
  provider: string;
  triageModel: string;
  draftModel: string;
  simulateOutage: boolean;
  version: number;
  updatedAt: Date;
}

export interface AiRuntime {
  settings(): Promise<AiSettingsRow>;
  invalidate(): void;
  /**
   * The provider and model for a task: the workspace's model when the active provider has it,
   * else the platform's. Throws a non-retryable AiError when AI is switched off or not configured.
   */
  resolve(
    task: 'TRIAGE' | 'DRAFT',
    preferred?: string | null,
  ): Promise<{ provider: LlmProvider; model: string }>;
  configuredProviders(): string[];
  providerById(id: string): LlmProvider | undefined;
}

const CACHE_MS = 2000;

/** Reads the admin-chosen provider/model from the DB (briefly cached) and maps it to a provider. */
export function createAiRuntime(
  db: Db,
  providers: Map<string, LlmProvider>,
  now: () => Date,
): AiRuntime {
  let cached: { row: AiSettingsRow; at: number } | null = null;
  const settings = async (): Promise<AiSettingsRow> => {
    const t = now().getTime();
    if (cached && t - cached.at < CACHE_MS) return cached.row;
    const row = await db.aiSettings.findUniqueOrThrow({ where: { id: 1 } });
    cached = { row, at: t };
    return row;
  };
  return {
    settings,
    invalidate: () => {
      cached = null;
    },
    async resolve(task, preferred) {
      const s = await settings();
      if (s.simulateOutage) throw new AiOutageSimulatedError('AI outage simulation is switched on');
      const provider = providers.get(s.provider);
      if (!provider)
        throw new AiNotConfiguredError(`Provider "${s.provider}" has no credentials configured`);
      const platform = task === 'TRIAGE' ? s.triageModel : s.draftModel;
      const own = preferred && findModel(s.provider, preferred) ? preferred : null;
      return { provider, model: own ?? platform };
    },
    configuredProviders: () => [...providers.keys()],
    providerById: (id) => providers.get(id),
  };
}
