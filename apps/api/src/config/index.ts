import { z } from 'zod';
import { AiConfig } from './ai.js';
import { AuthConfig } from './auth.js';
import { ChatConfig } from './chat.js';
import { DatabaseConfig } from './database.js';
import { HostConfig } from './host.js';
import { PlatformConfig } from './platform.js';
import { ServerConfig } from './server.js';
import { SharedStateConfig } from './shared-state.js';
import { VoiceConfig } from './voice.js';

/** Every runtime setting, one small schema per area, validated once at startup. */
const EnvSchema = z
  .object({
    ...ServerConfig.shape,
    ...DatabaseConfig.shape,
    ...AuthConfig.shape,
    ...AiConfig.shape,
    ...ChatConfig.shape,
    ...VoiceConfig.shape,
    ...HostConfig.shape,
    ...PlatformConfig.shape,
    ...SharedStateConfig.shape,
  })
  .refine((env) => env.HOST_SIGNING_SECRET !== env.JWT_SECRET, {
    path: ['HOST_SIGNING_SECRET'],
    message: 'must differ from JWT_SECRET (the host knows it)',
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.SECRETS_MASTER_KEY !== undefined, {
    path: ['SECRETS_MASTER_KEY'],
    message: 'is required in production (workspace secrets are encrypted with it)',
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.REDIS_URL !== undefined, {
    path: ['REDIS_URL'],
    message:
      'is required in production (every copy of the API shares live updates, rate limits and one-use tokens through Redis)',
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.CONNECTOR_ALLOW_PRIVATE_HOSTS, {
    path: ['CONNECTOR_ALLOW_PRIVATE_HOSTS'],
    message: 'must be false in production',
  });

export type Env = z.infer<typeof EnvSchema>;

/** Reads and checks the settings; the process refuses to start on bad config. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration — ${issues}`);
  }
  return parsed.data;
}
