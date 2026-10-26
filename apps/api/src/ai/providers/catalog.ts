/**
 * Providers and models an admin may choose in AI Settings (server-side allowlist).
 * Prices are USD per million tokens, used only for cost logging.
 */
export interface ModelInfo {
  id: string;
  label: string;
  tier: 'fast' | 'balanced' | 'strong';
  inputPerMTok: number;
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
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', tier: 'fast', inputPerMTok: 0.1, outputPerMTok: 0.5 },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', tier: 'balanced', inputPerMTok: 2, outputPerMTok: 10 },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', tier: 'strong', inputPerMTok: 4, outputPerMTok: 20 },
    ],
  },
];

/** Defaults: a fast model classifies, a balanced model writes customer-facing prose. */
export const DEFAULT_AI_SETTINGS = {
  provider: 'anthropic',
  triageModel: 'claude-haiku-5-5',
  draftModel: 'claude-sonnet-5-5',
} as const;

export function findModel(providerId: string, modelId: string): ModelInfo | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === providerId)?.models.find((m) => m.id === modelId);
}

/** Cost in micro-dollars. Cache reads ~0.1×, cache writes ~1.25× the input price. */
export function estimateCostMicros(
  model: ModelInfo | undefined,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number },
): number | null {
  if (!model) return null;
  const input =
    usage.inputTokens + usage.cacheReadTokens * 0.1 + usage.cacheWriteTokens * 1.25;
  return Math.round(input * model.inputPerMTok + usage.outputTokens * model.outputPerMTok);
}
