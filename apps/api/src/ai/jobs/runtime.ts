import type { Db } from '../../platform/db.js';
import { asPlatform } from '../../platform/tenancy.js';
import {
  AiDisabledForWorkspaceError,
  AiNotConfiguredError,
  AiOutageSimulatedError,
} from '../providers/errors.js';
import type { LlmProvider } from '../providers/types.js';

/** The platform's shared AI settings (platform_settings, U-7): one row for every customer. */
export interface AiSettingsRow {
  provider: string;
  triageModel: string;
  draftModel: string;
  chatModel: string;
  voiceModel: string | null;
  simulateOutage: boolean;
  version: number;
  updatedAt: Date;
}

export type AiTask = 'TRIAGE' | 'DRAFT' | 'CHAT';

export interface AiRuntime {
  settings(): Promise<AiSettingsRow>;
  invalidate(key?: string): void;
  /**
   * The provider and model the platform runs this task on, for this customer. Throws a
   * non-retryable AiError when AI is off (globally or for the customer) or has no key.
   */
  resolve(
    task: AiTask,
    choice?: { workspaceId?: string },
  ): Promise<{ provider: LlmProvider; model: string; providerId: string }>;
  /** The platform client for a provider (saved console key, else env key). */
  provider(providerId: string): Promise<LlmProvider | undefined>;
  /** Providers that have a usable key right now. */
  configuredProviders(ids: readonly string[]): Promise<string[]>;
}

export interface AiRuntimeDeps {
  db: Db;
  now: () => Date;
  provider: (providerId: string) => Promise<LlmProvider | undefined>;
  /** False when a super admin switched AI off for this customer. */
  aiAllowed: (workspaceId: string) => Promise<boolean>;
}

const CACHE_MS = 2000;
const MODEL_OF = { TRIAGE: 'triageModel', DRAFT: 'draftModel', CHAT: 'chatModel' } as const;

/** Reads the platform settings on the owner connection (briefly cached) and picks the client. */
export function createAiRuntime(deps: AiRuntimeDeps): AiRuntime {
  let cached: { row: AiSettingsRow; at: number } | null = null;
  const settings = async (): Promise<AiSettingsRow> => {
    const t = deps.now().getTime();
    if (cached && t - cached.at < CACHE_MS) return cached.row;
    const row = await asPlatform(() =>
      deps.db.platformSettings.findUniqueOrThrow({ where: { id: 1 } }),
    );
    cached = { row, at: t };
    return row;
  };
  return {
    settings,
    invalidate: () => {
      cached = null;
    },
    provider: deps.provider,
    async resolve(task, { workspaceId } = {}) {
      const s = await settings();
      if (s.simulateOutage) throw new AiOutageSimulatedError('AI outage simulation is switched on');
      if (workspaceId && !(await deps.aiAllowed(workspaceId)))
        throw new AiDisabledForWorkspaceError('AI is switched off for this customer');
      const provider = await deps.provider(s.provider);
      if (!provider)
        throw new AiNotConfiguredError(`Provider "${s.provider}" has no credentials configured`);
      return { provider, model: s[MODEL_OF[task]], providerId: s.provider };
    },
    async configuredProviders(ids) {
      const found = await Promise.all(
        ids.map(async (id) => ((await deps.provider(id)) ? id : null)),
      );
      return found.filter((id): id is string => id !== null);
    },
  };
}
