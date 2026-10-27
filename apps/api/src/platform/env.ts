import { z } from 'zod';

/** Every runtime setting, validated once at startup. The process refuses to start on bad config. */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  APP_ORIGIN: z.url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().startsWith('postgres'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(72).default(8),
  DATA_AS_OF: z.iso.date().default('2025-12-31'),
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  WEB_DIST_DIR: z.string().optional(),
  WORKER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  WORKER_POLL_MS: z.coerce.number().int().min(100).max(60_000).default(1000),
  // Author assistant limits (abuse protection). Admins switch the features on/off in the UI.
  CHAT_MESSAGES_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(20),
  CHAT_MESSAGES_PER_DAY: z.coerce.number().int().min(1).max(2000).default(100),
  CHAT_MAX_TURNS_PER_SESSION: z.coerce.number().int().min(1).max(200).default(30),
  CHAT_SESSIONS_PER_HOUR: z.coerce.number().int().min(1).max(100).default(10),
  VOICE_MAX_CALL_SECONDS: z.coerce.number().int().min(30).max(300).default(300),
  VOICE_CALLS_PER_HOUR: z.coerce.number().int().min(1).max(60).default(5),
  VOICE_CALLS_PER_DAY: z.coerce.number().int().min(1).max(200).default(10),
  // Speech-to-speech provider for voice calls (raw WebSocket, no SDK). Missing key = voice unavailable.
  VOICE_PROVIDER: z.enum(['openai']).default('openai'),
  VOICE_MODEL: z.string().min(1).max(80).default('gpt-realtime-2.1'),
  VOICE_NAME: z.string().min(1).max(40).default('marin'),
  OPENAI_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration — ${issues}`);
  }
  return parsed.data;
}
