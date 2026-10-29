import { z } from 'zod';
import { VOICE_STYLES } from '../voice/call/persona.js';
import { int, optionalSecret } from './fields.js';

/** Voice calls: limits and the speech-to-speech provider. A missing key means voice is unavailable. */
export const VoiceConfig = z.object({
  VOICE_MAX_CALL_SECONDS: int(30, 300, 300),
  VOICE_CALLS_PER_HOUR: int(1, 60, 5),
  VOICE_CALLS_PER_DAY: int(1, 200, 10),
  VOICE_PROVIDER: z.enum(['openai']).default('openai'),
  VOICE_MODEL: z.string().min(1).max(80).default('gpt-realtime-2.1'),
  VOICE_NAME: z.string().min(1).max(40).default('marin'),
  /** How the voice assistant speaks: warm Hinglish that mirrors the author, or English only. */
  VOICE_STYLE: z.enum(VOICE_STYLES).default('hinglish'),
  OPENAI_API_KEY: optionalSecret(),
  /**
   * Where browsers reach this API's call socket directly (wss://…), when the web app is served
   * from another site (e.g. a static host that cannot proxy WebSockets). Unset: same host as the page.
   */
  PUBLIC_API_WS_ORIGIN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .url({ protocol: /^wss?$/ })
      .transform((u) => {
        const { protocol, host } = new URL(u);
        return `${protocol}//${host}`;
      })
      .optional(),
  ),
});
