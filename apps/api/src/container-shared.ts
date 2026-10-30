import type { Env } from './config/index.js';
import { usedTokenIds } from './modules/auth/used-tokens.js';
import { draftLiveUpdates } from './modules/ticket-drafts/live.js';
import type { Clock } from './platform/clock.js';
import { sharedEventBus } from './platform/event-bus.js';
import { createCacheSync } from './platform/shared-state/cache-sync.js';
import { createSharedState, stderrLog } from './platform/shared-state/registry.js';
import type { SharedState, SharedStateLog } from './platform/shared-state/types.js';

export interface SharedOverrides {
  /** A ready-made backend, e.g. an in-memory one shared by two containers in a unit test. */
  sharedState?: SharedState;
  /** Where shared-state problems are reported (defaults to JSON lines on stderr). */
  log?: SharedStateLog;
}

/**
 * Everything that must look the same on every copy of the API (F-19): live ticket events, live
 * draft changes for calls, settings-cache clearing, one-use token ids, rate counters and the chat
 * queue. Built on the shared-state backend that the config chose (Redis in production).
 */
export function createSharedParts(env: Env, clock: Clock, overrides: SharedOverrides) {
  const log = overrides.log ?? stderrLog;
  const state =
    overrides.sharedState ??
    createSharedState(
      { url: env.REDIS_URL, prefix: env.REDIS_KEY_PREFIX },
      () => clock.now().getTime(),
      log,
    );
  const events = sharedEventBus(state, log);
  const draftLive = draftLiveUpdates(state, log);
  const cacheSync = createCacheSync(state, log);
  const channels = [events, draftLive, cacheSync];
  return {
    state,
    log,
    events: events.bus,
    draftLive,
    cacheSync,
    usedTokens: {
      host: usedTokenIds(state.claims, clock, 'host-sign-in'),
      voiceStream: usedTokenIds(state.claims, clock, 'voice-stream'),
    },
    /** Refuses (SharedStateUnavailableError) when the backend cannot be reached at startup. */
    async ready(): Promise<void> {
      await state.ready();
      await Promise.all(channels.map((c) => c.ready));
    },
    async close(): Promise<void> {
      await Promise.all(channels.map((c) => c.close()));
      await state.close();
    },
  };
}

export type SharedParts = ReturnType<typeof createSharedParts>;
