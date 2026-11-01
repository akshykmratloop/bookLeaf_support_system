import type { HostRecords } from './host/types.js';
import { ALL_VOICES, VOICE_PROVIDER_IDS, voiceSamplesFor } from './voice/providers/registry.js';
import { createConnectorService } from './modules/connectors/service.js';
import { connectorDepsFromEnv, ssrfPolicyFromEnv } from './modules/connectors/from-env.js';
import { createWebhookService } from './modules/webhooks/service.js';
import { createServerApiService } from './modules/server-api/service.js';
import { verifyApiKey } from './modules/workspaces/api-keys.js';
import { limitsFromEnv, type AssistantLimits } from './modules/assistant/limits.js';
import { createAssistantService } from './modules/assistant/service.js';
import { createPlatformConsole } from './container-platform.js';
import type { PlanReader } from './modules/platform/plans.js';
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
import type { Db } from './platform/db.js';
import { createTenantDb } from './platform/tenant-db.js';
import { createCategoryService } from './modules/categories/service.js';
import { createOnboardingService } from './modules/onboarding/service.js';
import type { Env } from './config/index.js';

import { createProviders, type ProviderOverrides } from './container-providers.js';
import { createSharedParts, type SharedOverrides } from './container-shared.js';
import { createDeviceTokens } from './modules/auth/device-token.js';
import { loginThrottle } from './modules/auth/login-throttle.js';
import type { CacheSync } from './platform/shared-state/cache-sync.js';

export interface ContainerOverrides extends ProviderOverrides, SharedOverrides {
  clock?: Clock;
  /** Replaces both connections with one client (no row-level security); tests use the env's. */
  db?: Db;
  /** The host product's records; tests pass a real demo host or a fake. */
  records?: HostRecords;
}

/** Settings caches stay per copy and are cleared on every copy when a setting is saved (F-19). */
function createSettingsCaches(
  { env, db, clock, cacheSync }: { env: Env; db: Db; clock: Clock; cacheSync: CacheSync },
  limits: AssistantLimits,
  plans: PlanReader,
) {
  const embedOrigins = createEmbedOrigins(db, env.HOST_ORIGINS, () => clock.now());
  const configs = createWorkspaceConfigs(db, { limits, voiceName: env.VOICE_NAME, plans });
  return {
    embedOrigins: cacheSync.shared('embed-origins', embedOrigins),
    configs: cacheSync.shared('workspace-configs', configs),
  };
}

/** Shared infrastructure every module uses: clock, database, events, AI runtime, sessions. */
function createCore(env: Env, overrides: ContainerOverrides) {
  const clock = overrides.clock ?? systemClock(env.DATA_AS_OF);
  // Requests on the restricted app role under RLS; platform work on the owner (S.8).
  const db =
    overrides.db ?? createTenantDb({ appUrl: env.DATABASE_URL, adminUrl: env.DATABASE_ADMIN_URL });
  const shared = createSharedParts(env, clock, overrides);
  const { events, cacheSync } = shared;
  const providerInputs = { env, db, clock, cacheSync, log: shared.log };
  const providers = createProviders(providerInputs, overrides);
  const { voiceProvider, envelope, platform, plans, ai } = providers;
  const sessions = createSessions(env.JWT_SECRET, env.SESSION_TTL_HOURS, clock, db);
  const connectors = createConnectorService(connectorDepsFromEnv(env, db, clock));
  const records = overrides.records ?? connectors.records;
  const ticketDeps = { db, clock, events, records };
  const limits = limitsFromEnv(env);
  const caches = createSettingsCaches({ env, db, clock, cacheSync }, limits, plans);
  const { embedOrigins, configs } = caches;
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
    /** The AI and voice clients every customer runs on (console key, else env key). */
    platform,
    plans,
    envAi: providers.envAi,
    voiceProvider,
    /** The platform's voice client for a customer's call (every customer uses the same one). */
    voiceFor: (_workspaceId: string) => platform.voice(),
    /** Failed sign-ins per browser and account, shared by every copy of the API. */
    loginThrottle: loginThrottle(shared.state.counters, createDeviceTokens(env.JWT_SECRET, clock)),
  };
}

type Core = ReturnType<typeof createCore>;

/** The author assistant: switches and limits, chat, voice calls and the shared ticket draft. */
function createAssistants({ env, db, ai, configs, plans, ticketDeps, voiceFor, shared: sh }: Core) {
  const draftLive = sh.draftLive;
  const ticketDrafts = createTicketDraftService({ ...ticketDeps, live: draftLive });
  const assistant = createAssistantService({
    db,
    ai,
    configs,
    plans,
    voiceConfigured: async (ws: string) => (await voiceFor(ws)) !== null,
  });
  const shared = { ...ticketDeps, assistant, drafts: ticketDrafts };
  return {
    assistant,
    draftLive,
    ticketDrafts,
    chat: createChatService({
      ...shared,
      queues: sh.state.queues,
      counters: sh.state.counters,
    }),
    voice: createVoiceService({
      ...shared,
      voiceFor,
      live: draftLive,
      voiceStyle: env.VOICE_STYLE,
    }),
  };
}

/** How the workspace's own systems connect: webhooks and the server API. */
function createIntegrations(core: Core) {
  return {
    webhooks: createWebhookService({
      db: core.db,
      clock: core.clock,
      envelope: core.envelope,
      ssrf: ssrfPolicyFromEnv(core.env),
    }),
    serverApi: createServerApiService(core.ticketDeps, (key) =>
      verifyApiKey({ db: core.db, clock: core.clock }, key),
    ),
  };
}

/** All wiring in one place: plain factories, explicit dependencies, no hidden globals. */
export function createContainer(env: Env, overrides: ContainerOverrides = {}) {
  const core = createCore(env, overrides);
  const hostSessionTtlSeconds = env.HOST_SESSION_TTL_HOURS * 3600;
  const hostSignIn = { ...core, usedTokens: core.shared.usedTokens.host, hostSessionTtlSeconds };
  return {
    ...core,
    hostSessionTtlSeconds,
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
      voiceConfigured: async (ws: string) => (await core.voiceFor(ws)) !== null,
      voices: core.voiceProvider?.voices ?? ALL_VOICES,
      voiceSamples: voiceSamplesFor(env.VOICE_PROVIDER, core.voiceProvider?.voices ?? ALL_VOICES),
      configs: core.configs,
      plans: core.plans,
      embedOrigins: core.embedOrigins,
    }),
    ...createIntegrations(core),
    books: createBooksService(core),
    categories: createCategoryService({ db: core.db }),
    onboarding: createOnboardingService({
      db: core.db,
      embedded: core.embedded,
      originsFor: (slug) => core.embedOrigins.originsFor(slug),
      tickets: core.ticketDeps,
      supportUrl: env.APP_ORIGIN,
      docsUrl: env.INTEGRATION_DOCS_URL ?? null,
    }),
    conversations: createConversationService(core.db),
    platformConsole: createPlatformConsole(core, VOICE_PROVIDER_IDS),
    ...createAssistants(core),
  };
}

export type Container = ReturnType<typeof createContainer>;
