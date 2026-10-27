import { createAiRuntime, type AiRuntime } from './ai/jobs/runtime.js';
import { buildProviderRegistry } from './ai/providers/registry.js';
import type { LlmProvider } from './ai/providers/types.js';
import type { HostRecords } from './host/types.js';
import { buildVoiceProvider } from './voice/providers/registry.js';
import type { VoiceProvider } from './voice/providers/types.js';
import { createAiAdminService } from './modules/ai-admin/service.js';
import { createConnectorService } from './modules/connectors/service.js';
import { connectorDepsFromEnv } from './modules/connectors/from-env.js';
import { limitsFromEnv } from './modules/assistant/limits.js';
import { platformSwitches } from './modules/assistant/deps.js';
import { createAssistantService } from './modules/assistant/service.js';
import { createWorkspaceConfigs } from './modules/settings/configs.js';
import { usedTokenIds } from './modules/auth/used-tokens.js';
import { createAuthService } from './modules/auth/service.js';
import { createSessionCodec } from './modules/auth/session.js';
import { createBooksService } from './modules/books/service.js';
import { createChatService } from './modules/chat/service.js';
import { createConversationService } from './modules/conversations/service.js';
import { draftLiveUpdates } from './modules/ticket-drafts/live.js';
import { createTicketDraftService } from './modules/ticket-drafts/service.js';
import { createVoiceService } from './modules/voice/service.js';
import { createSettingsService } from './modules/settings/service.js';
import { createHostSignIn } from './modules/workspaces/host-sign-in.js';
import { createWorkspaceService } from './modules/workspaces/service.js';
import { systemClock, type Clock } from './platform/clock.js';
import { createDb, type Db } from './platform/db.js';
import type { Env } from './config/index.js';
import { inMemoryEventBus, type EventBus } from './platform/event-bus.js';

export interface ContainerOverrides {
  clock?: Clock;
  db?: Db;
  providers?: Map<string, LlmProvider>;
  /** The host product's records; tests pass a real demo host or a fake. */
  records?: HostRecords;
  /** null = no voice provider configured. */
  voiceProvider?: VoiceProvider | null;
}

/** Shared infrastructure every module uses: clock, database, events, AI runtime, sessions. */
function createCore(env: Env, overrides: ContainerOverrides) {
  const clock = overrides.clock ?? systemClock(env.DATA_AS_OF);
  const db = overrides.db ?? createDb(env.DATABASE_URL);
  const events: EventBus = inMemoryEventBus();
  const providers =
    overrides.providers ?? buildProviderRegistry({ anthropicApiKey: env.ANTHROPIC_API_KEY });
  const ai: AiRuntime = createAiRuntime(db, providers, () => clock.now());
  const sessions = createSessionCodec(env.JWT_SECRET, env.SESSION_TTL_HOURS, clock);
  const voiceProvider =
    overrides.voiceProvider === undefined ? buildVoiceProvider(env) : overrides.voiceProvider;
  const connectors = createConnectorService(connectorDepsFromEnv(env, db, clock));
  const records = overrides.records ?? connectors.records;
  const ticketDeps = { db, clock, events, records };
  const limits = limitsFromEnv(env);
  const configs = createWorkspaceConfigs(db, {
    limits,
    voiceName: env.VOICE_NAME,
    switches: () => platformSwitches(db),
  });
  return {
    env,
    clock,
    db,
    events,
    ai,
    sessions,
    records,
    connectors,
    ticketDeps,
    limits,
    configs,
    voiceProvider,
  };
}

type Core = ReturnType<typeof createCore>;

/** The author assistant: switches and limits, chat, voice calls and the shared ticket draft. */
function createAssistants({ env, db, ai, configs, ticketDeps, voiceProvider }: Core) {
  const draftLive = draftLiveUpdates();
  const ticketDrafts = createTicketDraftService({ ...ticketDeps, live: draftLive });
  const assistant = createAssistantService({
    db,
    ai,
    configs,
    voiceConfigured: voiceProvider !== null,
  });
  const shared = { ...ticketDeps, assistant, drafts: ticketDrafts };
  return {
    assistant,
    draftLive,
    ticketDrafts,
    chat: createChatService(shared),
    voice: createVoiceService({
      ...shared,
      provider: voiceProvider,
      live: draftLive,
      voiceStyle: env.VOICE_STYLE,
    }),
  };
}

/** All wiring in one place: plain factories, explicit dependencies, no hidden globals. */
export function createContainer(env: Env, overrides: ContainerOverrides = {}) {
  const core = createCore(env, overrides);
  const hostSignIn = { ...core, usedTokens: usedTokenIds(core.clock) };
  return {
    ...core,
    auth: createAuthService(core.db, core.sessions),
    signInFromHost: createHostSignIn(hostSignIn, {
      db: core.db,
      defaultSecret: env.HOST_SIGNING_SECRET,
      secretFor: core.connectors.secretFor,
    }),
    workspaces: createWorkspaceService(core),
    settings: createSettingsService({
      db: core.db,
      ai: core.ai,
      voiceConfigured: core.voiceProvider !== null,
      voices: core.voiceProvider?.voices ?? [],
      configs: core.configs,
    }),
    books: createBooksService(core),
    conversations: createConversationService(core.db),
    aiAdmin: createAiAdminService({ db: core.db, ai: core.ai, clock: core.clock }),
    ...createAssistants(core),
  };
}

export type Container = ReturnType<typeof createContainer>;
