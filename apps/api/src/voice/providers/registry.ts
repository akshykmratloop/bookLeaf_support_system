import type { Env } from '../../config/index.js';
import { openAiVoiceProvider } from './openai/provider.js';
import { OPENAI_VOICES } from './openai/voices.js';
import type { VoiceProvider } from './types.js';

/** Speech providers a super admin may save a key for in the console (U-7). */
export const VOICE_PROVIDER_IDS: readonly string[] = ['openai'];

/** Voices a workspace may choose when the platform itself has no voice provider. */
export const ALL_VOICES: readonly string[] = OPENAI_VOICES;

/** A provider client for one key and model (null model = VOICE_MODEL from env). */
export function voiceProviderFor(
  env: Env,
  providerId: string,
  apiKey: string,
  model: string | null = null,
) {
  if (providerId !== 'openai') return null;
  return openAiVoiceProvider({ apiKey, model: model ?? env.VOICE_MODEL, voice: env.VOICE_NAME });
}

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
