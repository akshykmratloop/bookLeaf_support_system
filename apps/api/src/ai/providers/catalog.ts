/**
 * Providers and models a super admin may choose in the console (server-side allowlist, U-7).
 * Prices are USD per million tokens, used for the per-call cost in ai_runs. They are Anthropic's
 * published prices (https://platform.claude.com/docs/en/about-claude/pricing), checked 2026-11-02.
 * Haiku has a dearer tier for prompts over 100k tokens; our prompts stay far below it.
 */
export interface ModelInfo {
  id: string;
  label: string;
  tier: 'fast' | 'balanced' | 'strong';
  inputPerMTok: number;
  /** Writing the prompt cache (5-minute lifetime). */
  cacheWritePerMTok: number;
  /** Reading from the prompt cache. Not a fixed share of the input price: check each model. */
  cacheReadPerMTok: number;
  outputPerMTok: number;
}

export interface ProviderInfo {
  id: string;
  label: string;
  models: readonly ModelInfo[];
}

export const PROVIDER_CATALOG: readonly ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    models: [
      {
        id: 'claude-haiku-5-5',
        label: 'Claude Haiku 5.5',
        tier: 'fast',
        inputPerMTok: 0.1,
        cacheWritePerMTok: 0.125,
        cacheReadPerMTok: 0.01,
        outputPerMTok: 0.5,
      },
      {
        id: 'claude-sonnet-5-5',
        label: 'Claude Sonnet 5.5',
        tier: 'balanced',
        inputPerMTok: 2,
        cacheWritePerMTok: 2.5,
        cacheReadPerMTok: 0.1,
        outputPerMTok: 10,
      },
      {
        id: 'claude-opus-5-5',
        label: 'Claude Opus 5.5',
        tier: 'strong',
        inputPerMTok: 4,
        cacheWritePerMTok: 5,
        cacheReadPerMTok: 0.2,
        outputPerMTok: 20,
      },
    ],
  },
];

/** Defaults: a fast model classifies and chats, a balanced model writes customer-facing prose. */
export const DEFAULT_AI_SETTINGS = {
  provider: 'anthropic',
  triageModel: 'claude-haiku-5-5',
  draftModel: 'claude-sonnet-5-5',
  chatModel: 'claude-haiku-5-5',
} as const;

export function findModel(providerId: string, modelId: string): ModelInfo | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === providerId)?.models.find((m) => m.id === modelId);
}

/**
 * Cost in micro-dollars ($1 per million tokens = 1 micro-dollar per token). `inputTokens` is the
 * uncached input only; cache reads and writes are priced at the model's own cache rates.
 */
export function estimateCostMicros(
  model: ModelInfo | undefined,
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  },
): number | null {
  if (!model) return null;
  return Math.round(
    usage.inputTokens * model.inputPerMTok +
      usage.cacheWriteTokens * model.cacheWritePerMTok +
      usage.cacheReadTokens * model.cacheReadPerMTok +
      usage.outputTokens * model.outputPerMTok,
  );
}
