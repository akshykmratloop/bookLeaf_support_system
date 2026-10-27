import type { Db } from '../../platform/db.js';
import { AiNotConfiguredError, AiOutageSimulatedError } from '../providers/errors.js';
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
  /** Throws a non-retryable AiError when AI is switched off or not configured. */
  resolve(task: 'TRIAGE' | 'DRAFT'): Promise<{ provider: LlmProvider; model: string }>;
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
    async resolve(task) {
      const s = await settings();
      if (s.simulateOutage) throw new AiOutageSimulatedError('AI outage simulation is switched on');
      const provider = providers.get(s.provider);
      if (!provider)
        throw new AiNotConfiguredError(`Provider "${s.provider}" has no credentials configured`);
      return { provider, model: task === 'TRIAGE' ? s.triageModel : s.draftModel };
    },
    configuredProviders: () => [...providers.keys()],
    providerById: (id) => providers.get(id),
  };
}
