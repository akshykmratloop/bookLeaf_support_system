import { createAiRuntime, type AiRuntime } from './ai/jobs/runtime.js';
import { PROVIDER_CATALOG } from './ai/providers/catalog.js';
import { buildProviderRegistry } from './ai/providers/registry.js';
import type { LlmProvider } from './ai/providers/types.js';
import type { HostRecords } from './host/types.js';
import {
  ALL_VOICES,
  buildVoiceProvider,
  VOICE_PROVIDER_IDS,
  voiceProviderFor,
} from './voice/providers/registry.js';
import type { VoiceProvider } from './voice/providers/types.js';
import { createAiAdminService } from './modules/ai-admin/service.js';
import { createConnectorService } from './modules/connectors/service.js';
import { connectorDepsFromEnv, envelopeFromEnv } from './modules/connectors/from-env.js';
import { createKeyedProviders } from './modules/provider-keys/keyed.js';
import { createProviderKeyService } from './modules/provider-keys/service.js';
import { limitsFromEnv } from './modules/assistant/limits.js';
import { platformSwitches } from './modules/assistant/deps.js';
import { createAssistantService } from './modules/assistant/service.js';
import { createWorkspaceConfigs } from './modules/settings/configs.js';
import { createEmbedOrigins } from './modules/settings/embed-origins.js';
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
  /** Builds a client from a workspace's own AI key (tests pass a fake). */
  buildAi?: (providerId: string, apiKey: string) => LlmProvider | undefined;
  /** Builds a client from a workspace's own voice key (tests pass a fake). */
  buildVoice?: (providerId: string, apiKey: string) => VoiceProvider | null;
}

/** AI and voice clients: the platform's from env, and each workspace's own from its saved keys. */
function createProviders(env: Env, db: Db, clock: Clock, overrides: ContainerOverrides) {
  const providers =
    overrides.providers ?? buildProviderRegistry({ anthropicApiKey: env.ANTHROPIC_API_KEY });
  const voiceProvider =
    overrides.voiceProvider === undefined ? buildVoiceProvider(env) : overrides.voiceProvider;
  const envelope = envelopeFromEnv(env);
  const keyed = createKeyedProviders({
    db,
    envelope,
    now: () => clock.now(),
    platformAi: providers,
    platformVoice: voiceProvider,
    buildAi:
      overrides.buildAi ?? ((id, key) => buildProviderRegistry({ anthropicApiKey: key }).get(id)),
    buildVoice: overrides.buildVoice ?? ((id, key) => voiceProviderFor(env, id, key)),
  });
  const ai: AiRuntime = createAiRuntime(db, providers, () => clock.now(), keyed.ai);
  return { voiceProvider, envelope, keyed, ai };
}

/** Shared infrastructure every module uses: clock, database, events, AI runtime, sessions. */
function createCore(env: Env, overrides: ContainerOverrides) {
  const clock = overrides.clock ?? systemClock(env.DATA_AS_OF);
  const db = overrides.db ?? createDb(env.DATABASE_URL);
  const events: EventBus = inMemoryEventBus();
  const { voiceProvider, envelope, keyed, ai } = createProviders(env, db, clock, overrides);
  const sessions = createSessionCodec(env.JWT_SECRET, env.SESSION_TTL_HOURS, clock);
  const connectors = createConnectorService(connectorDepsFromEnv(env, db, clock));
  const records = overrides.records ?? connectors.records;
  const ticketDeps = { db, clock, events, records };
  const limits = limitsFromEnv(env);
  const embedOrigins = createEmbedOrigins(db, env.HOST_ORIGINS, () => clock.now());
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
    embedded: env.EMBED_ENABLED || env.HOST_ORIGINS.length > 0,
    embedOrigins,
    envelope,
    keyed,
    voiceProvider,
  };
}

type Core = ReturnType<typeof createCore>;

/** The author assistant: switches and limits, chat, voice calls and the shared ticket draft. */
function createAssistants({ env, db, ai, configs, ticketDeps, keyed }: Core) {
  const voiceFor = (workspaceId: string) => keyed.voice(workspaceId);
  const draftLive = draftLiveUpdates();
  const ticketDrafts = createTicketDraftService({ ...ticketDeps, live: draftLive });
  const assistant = createAssistantService({
    db,
    ai,
    configs,
    voiceConfigured: async (ws: string) => (await voiceFor(ws)) !== null,
  });
  const shared = { ...ticketDeps, assistant, drafts: ticketDrafts };
  return {
    assistant,
    draftLive,
    ticketDrafts,
    chat: createChatService(shared),
    voice: createVoiceService({
      ...shared,
      voiceFor,
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
      voiceConfigured: async (ws: string) => (await core.keyed.voice(ws)) !== null,
      voices: core.voiceProvider?.voices ?? ALL_VOICES,
      configs: core.configs,
      embedOrigins: core.embedOrigins,
    }),
    providerKeys: createProviderKeyService({
      db: core.db,
      envelope: core.envelope,
      keyed: core.keyed,
      providers: { AI: PROVIDER_CATALOG.map((p) => p.id), VOICE: VOICE_PROVIDER_IDS },
    }),
    books: createBooksService(core),
    conversations: createConversationService(core.db),
    aiAdmin: createAiAdminService({ db: core.db, ai: core.ai, clock: core.clock }),
    ...createAssistants(core),
  };
}

export type Container = ReturnType<typeof createContainer>;
