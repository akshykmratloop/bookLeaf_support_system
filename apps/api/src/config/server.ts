import { z } from 'zod';
import { int } from './fields.js';

/** How the HTTP server runs and where the web app is served from. */
export const ServerConfig = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(1, 65535, 3000),
  HOST: z.string().default('0.0.0.0'),
  /** The one browser origin allowed to call the API (CSRF and WebSocket checks). */
  APP_ORIGIN: z.url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Built web app to serve, relative to apps/api. Unset in development (Vite serves it). */
  WEB_DIST_DIR: z.string().optional(),
});
