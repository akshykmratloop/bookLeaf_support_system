import { memoryBackend, memorySharedState } from './memory/index.js';
import { redisSharedState } from './redis/index.js';
import type { SharedState, SharedStateLog } from './types.js';

export interface SharedStateConfig {
  /** Redis address; required in production (the config refuses to start without it). */
  url: string | undefined;
  prefix: string;
}

/**
 * Picks the backend once, at startup. With a Redis address every copy shares one state. Without
 * one (only allowed outside production) the state is in this process's memory: correct for a
 * single copy only, and said so loudly in the log.
 */
export function createSharedState(
  config: SharedStateConfig,
  now: () => number,
  log: SharedStateLog,
): SharedState {
  if (config.url) return redisSharedState({ url: config.url, prefix: config.prefix, log });
  log.warn(
    { backend: 'memory' },
    'REDIS_URL is not set: live updates, rate limits and one-time tokens are kept in this process only (one instance)',
  );
  return memorySharedState(memoryBackend(now));
}

/** Writes one JSON line to stderr: used before the app's own logger exists. */
export const stderrLog: SharedStateLog = {
  warn: (details, message) =>
    process.stderr.write(`${JSON.stringify({ level: 'warn', msg: message, ...details })}\n`),
  error: (details, message) =>
    process.stderr.write(`${JSON.stringify({ level: 'error', msg: message, ...details })}\n`),
};
