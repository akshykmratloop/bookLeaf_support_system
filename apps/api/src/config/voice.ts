import { z } from 'zod';
import { int, optionalSecret } from './fields.js';

/** Voice calls: limits and the speech-to-speech provider. A missing key means voice is unavailable. */
export const VoiceConfig = z.object({
  VOICE_MAX_CALL_SECONDS: int(30, 300, 300),
  VOICE_CALLS_PER_HOUR: int(1, 60, 5),
  VOICE_CALLS_PER_DAY: int(1, 200, 10),
  VOICE_PROVIDER: z.enum(['openai']).default('openai'),
  VOICE_MODEL: z.string().min(1).max(80).default('gpt-realtime-2.1'),
  VOICE_NAME: z.string().min(1).max(40).default('marin'),
  OPENAI_API_KEY: optionalSecret(),
});
