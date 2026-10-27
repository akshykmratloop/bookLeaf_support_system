import { createAiRuntime, type AiRuntime } from './ai/jobs/runtime.js';
import { buildProviderRegistry } from './ai/providers/registry.js';
import type { LlmProvider } from './ai/providers/types.js';
import { buildVoiceProvider } from './voice/providers/registry.js';
import type { VoiceProvider } from './voice/providers/types.js';
import { createAiAdminService } from './modules/ai-admin/service.js';
import { limitsFromEnv } from './modules/assistant/limits.js';
import { createAssistantService } from './modules/assistant/service.js';
import { createAuthService } from './modules/auth/service.js';
import { createSessionCodec } from './modules/auth/session.js';
import { createBooksRepository } from './modules/books/repository.js';
import { createChatService } from './modules/chat/service.js';
import { draftLiveUpdates } from './modules/ticket-drafts/live.js';
import { createTicketDraftService } from './modules/ticket-drafts/service.js';
import { createVoiceService } from './modules/voice/service.js';
import { systemClock, type Clock } from './platform/clock.js';
import { createDb, type Db } from './platform/db.js';
import type { Env } from './platform/env.js';
import { inMemoryEventBus, type EventBus } from './platform/event-bus.js';

export interface ContainerOverrides {
  clock?: Clock;
  db?: Db;
  providers?: Map<string, LlmProvider>;
  /** null = no voice provider configured. */
  voiceProvider?: VoiceProvider | null;
}

/** All wiring in one place: plain factories, explicit dependencies, no hidden globals. */
export function createContainer(env: Env, overrides: ContainerOverrides = {}) {
  const clock = overrides.clock ?? systemClock(env.DATA_AS_OF);
  const db = overrides.db ?? createDb(env.DATABASE_URL);
  const events: EventBus = inMemoryEventBus();
  const providers =
    overrides.providers ?? buildProviderRegistry({ anthropicApiKey: env.ANTHROPIC_API_KEY });
  const ai: AiRuntime = createAiRuntime(db, providers, () => clock.now());
  const sessions = createSessionCodec(env.JWT_SECRET, env.SESSION_TTL_HOURS, clock);
  const ticketDeps = { db, clock, events };
  const limits = limitsFromEnv(env);
  const draftLive = draftLiveUpdates();
  const ticketDrafts = createTicketDraftService({ ...ticketDeps, live: draftLive });
  const voiceProvider =
    overrides.voiceProvider === undefined ? buildVoiceProvider(env) : overrides.voiceProvider;
  const assistant = createAssistantService({
    db,
    ai,
    limits,
    voiceConfigured: voiceProvider !== null,
  });
  return {
    env,
    clock,
    db,
    events,
    ai,
    sessions,
    auth: createAuthService(db, sessions),
    books: createBooksRepository(db),
    aiAdmin: createAiAdminService({ db, ai, clock }),
    ticketDeps,
    limits,
    assistant,
    draftLive,
    ticketDrafts,
    chat: createChatService({ ...ticketDeps, assistant, limits }),
    voiceProvider,
    voice: createVoiceService({ ...ticketDeps, assistant, limits, provider: voiceProvider }),
  };
}

export type Container = ReturnType<typeof createContainer>;
