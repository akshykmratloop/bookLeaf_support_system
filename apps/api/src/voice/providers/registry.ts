import type { Env } from '../../platform/env.js';
import { openAiVoiceProvider } from './openai/provider.js';
import type { VoiceProvider } from './types.js';

/**
 * Picks the configured speech-to-speech provider. A missing key is a normal state: voice is
 * reported as "not configured" and the rest of the portal is unaffected.
 */
export function buildVoiceProvider(env: Env): VoiceProvider | null {
  switch (env.VOICE_PROVIDER) {
    case 'openai':
      return env.OPENAI_API_KEY
        ? openAiVoiceProvider({
            apiKey: env.OPENAI_API_KEY,
            model: env.VOICE_MODEL,
            voice: env.VOICE_NAME,
          })
        : null;
    default:
      return null;
  }
}
