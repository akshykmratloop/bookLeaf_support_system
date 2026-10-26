import { anthropicProvider } from './anthropic/provider.js';
import type { LlmProvider } from './types.js';

export interface ProviderCredentials {
  anthropicApiKey?: string;
}

/**
 * Builds the providers whose credentials are present. Missing credentials are a normal state:
 * the provider is simply absent and the core uses its rule-based fallback.
 */
export function buildProviderRegistry(creds: ProviderCredentials): Map<string, LlmProvider> {
  const providers = new Map<string, LlmProvider>();
  if (creds.anthropicApiKey) {
    providers.set('anthropic', anthropicProvider({ apiKey: creds.anthropicApiKey }));
  }
  return providers;
}
