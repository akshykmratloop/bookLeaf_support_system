import { PROVIDER_CATALOG } from './ai/providers/catalog.js';
import type { HostRecords } from './host/types.js';
import { ALL_VOICES, VOICE_PROVIDER_IDS } from './voice/providers/registry.js';
import { createAiAdminService } from './modules/ai-admin/service.js';
import { createConnectorService } from './modules/connectors/service.js';
import { connectorDepsFromEnv, ssrfPolicyFromEnv } from './modules/connectors/from-env.js';
import { createWebhookService } from './modules/webhooks/service.js';
import { createServerApiService } from './modules/server-api/service.js';
import { verifyApiKey } from './modules/workspaces/api-keys.js';
import { createProviderKeyService } from './modules/provider-keys/service.js';
import { limitsFromEnv, type AssistantLimits } from './modules/assistant/limits.js';
import { platformSwitches } from './modules/assistant/deps.js';
import { createAssistantService } from './modules/assistant/service.js';
import { createWorkspaceConfigs } from './modules/settings/configs.js';
import { createEmbedOrigins } from './modules/settings/embed-origins.js';
import { createAuthService } from './modules/auth/service.js';
import { createSessions } from './modules/auth/session-versions.js';
import { createBooksService } from './modules/books/service.js';
import { createChatService } from './modules/chat/service.js';
import { createConversationService } from './modules/conversations/service.js';
import { createTicketDraftService } from './modules/ticket-drafts/service.js';
import { createVoiceService } from './modules/voice/service.js';
import { createSettingsService } from './modules/settings/service.js';
import { createHostSignIn } from './modules/workspaces/host-sign-in.js';
import { createWorkspaceService } from './modules/workspaces/service.js';
import { systemClock, type Clock } from './platform/clock.js';
import { createDb, type Db } from './platform/db.js';
import { createCategoryService } from './modules/categories/service.js';
import type { Env } from './config/index.js';

import { createProviders, type ProviderOverrides } from './container-providers.js';
import { createSharedParts, type SharedOverrides } from './container-shared.js';
import type { CacheSync } from './platform/shared-state/cache-sync.js';

export interface ContainerOverrides extends ProviderOverrides, SharedOverrides {
  clock?: Clock;
  db?: Db;
  /** The host product's records; tests pass a real demo host or a fake. */
  records?: HostRecords;
}

/** Settings caches stay per copy and are cleared on every copy when a setting is saved (F-19). */
function createSettingsCaches(
  { env, db, clock, cacheSync }: { env: Env; db: Db; clock: Clock; cacheSync: CacheSync },
  limits: AssistantLimits,
) {
  const embedOrigins = createEmbedOrigins(db, env.HOST_ORIGINS, () => clock.now());
  const configs = createWorkspaceConfigs(db, {
    limits,
    voiceName: env.VOICE_NAME,
    switches: () => platformSwitches(db),
  });
  return {
    embedOrigins: cacheSync.shared('embed-origins', embedOrigins),
    configs: cacheSync.shared('workspace-configs', configs),
  };
}

/** Shared infrastructure every module uses: clock, database, events, AI runtime, sessions. */
function createCore(env: Env, overrides: ContainerOverrides) {
  const clock = overrides.clock ?? systemClock(env.DATA_AS_OF);
  const db = overrides.db ?? createDb(env.DATABASE_URL);
  const shared = createSharedParts(env, clock, overrides);
  const { events, cacheSync } = shared;
  const providerInputs = { env, db, clock, cacheSync };
  const { voiceProvider, envelope, keyed, ai } = createProviders(providerInputs, overrides);
  const sessions = createSessions(env.JWT_SECRET, env.SESSION_TTL_HOURS, clock, db);
  const connectors = createConnectorService(connectorDepsFromEnv(env, db, clock));
  const records = overrides.records ?? connectors.records;
  const ticketDeps = { db, clock, events, records };
  const limits = limitsFromEnv(env);
  const { embedOrigins, configs } = createSettingsCaches({ env, db, clock, cacheSync }, limits);
  return {
    env,
    shared,
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
function createAssistants({ env, db, ai, configs, ticketDeps, keyed, shared: sh }: Core) {
  const voiceFor = (workspaceId: string) => keyed.voice(workspaceId);
  const draftLive = sh.draftLive;
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
    chat: createChatService({ ...shared, queues: sh.state.queues }),
    voice: createVoiceService({
      ...shared,
      voiceFor,
      live: draftLive,
      voiceStyle: env.VOICE_STYLE,
    }),
  };
}

/** How the workspace's own systems connect: provider keys, webhooks, the server API. */
function createIntegrations(core: Core) {
  return {
    providerKeys: createProviderKeyService({
      db: core.db,
      envelope: core.envelope,
      keyed: core.keyed,
      providers: { AI: PROVIDER_CATALOG.map((p) => p.id), VOICE: VOICE_PROVIDER_IDS },
    }),
    webhooks: createWebhookService({
      db: core.db,
      clock: core.clock,
      envelope: core.envelope,
      ssrf: ssrfPolicyFromEnv(core.env),
    }),
    serverApi: createServerApiService(core.db, (key) =>
      verifyApiKey({ db: core.db, clock: core.clock }, key),
    ),
  };
}

/** All wiring in one place: plain factories, explicit dependencies, no hidden globals. */
export function createContainer(env: Env, overrides: ContainerOverrides = {}) {
  const core = createCore(env, overrides);
  const hostSignIn = { ...core, usedTokens: core.shared.usedTokens.host };
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
    ...createIntegrations(core),
    books: createBooksService(core),
    categories: createCategoryService({ db: core.db }),
    conversations: createConversationService(core.db),
    aiAdmin: createAiAdminService({ db: core.db, ai: core.ai, clock: core.clock }),
    ...createAssistants(core),
  };
}

export type Container = ReturnType<typeof createContainer>;
