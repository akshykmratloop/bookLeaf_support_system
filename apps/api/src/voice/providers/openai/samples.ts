import { OPENAI_VOICES } from './voices.js';

/**
 * Pre-recorded samples of each voice, made once with `pnpm --filter @bookleaf/api voice-samples`
 * and served as static files by the web app. Shared by every customer: playing one costs nothing.
 */
export const OPENAI_VOICE_SAMPLES: Readonly<Record<string, string>> = Object.fromEntries(
  OPENAI_VOICES.map((voice) => [voice, `/voice-samples/openai/${voice}.mp3`]),
);
