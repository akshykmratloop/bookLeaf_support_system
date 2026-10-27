import { z } from 'zod';
import { AiConfig } from './ai.js';
import { AuthConfig } from './auth.js';
import { ChatConfig } from './chat.js';
import { DatabaseConfig } from './database.js';
import { HostConfig } from './host.js';
import { ServerConfig } from './server.js';
import { VoiceConfig } from './voice.js';

/** Every runtime setting, one small schema per area, validated once at startup. */
const EnvSchema = z.object({
  ...ServerConfig.shape,
  ...DatabaseConfig.shape,
  ...AuthConfig.shape,
  ...AiConfig.shape,
  ...ChatConfig.shape,
  ...VoiceConfig.shape,
  ...HostConfig.shape,
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
