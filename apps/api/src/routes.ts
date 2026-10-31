import type { FastifyInstance } from 'fastify';
import type { Container } from './container.js';
import { assistantRoutes } from './modules/assistant/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { booksRoutes } from './modules/books/routes.js';
import { categoryRoutes } from './modules/categories/routes.js';
import { chatRoutes } from './modules/chat/routes.js';
import { connectorRoutes } from './modules/connectors/routes.js';
import { conversationRoutes } from './modules/conversations/routes.js';
import { draftRoutes } from './modules/drafts/routes.js';
import { eventRoutes } from './modules/events/routes.js';
import { settingsRoutes } from './modules/settings/routes.js';
import { ticketDraftRoutes } from './modules/ticket-drafts/routes.js';
import { ticketRoutes } from './modules/tickets/routes.js';
import { managedRoutes } from './modules/managed/routes.js';
import { onboardingRoutes } from './modules/onboarding/routes.js';
import { platformAuthRoutes } from './modules/platform/auth-routes.js';
import { platformConsoleRoutes } from './modules/platform/console-routes.js';
import { platformGuard } from './modules/platform/guard.js';
import { serverApiRoutes } from './modules/server-api/routes.js';
import { webhookRoutes } from './modules/webhooks/routes.js';
import { voiceRoutes } from './modules/voice/routes.js';
import { createStreamTickets } from './modules/voice/stream-ticket.js';
import { sessionVersionsIn } from './modules/auth/session-versions.js';
import { apiKeyRoutes } from './modules/workspaces/api-key-routes.js';
import { workspaceRoutes } from './modules/workspaces/routes.js';

/** Sign-in: staff passwords, host hand-overs, and the session and device cookies. */
const authOptions = (c: Container) => ({
  auth: c.auth,
  signInFromHost: c.signInFromHost,
  hostSignInUrl: c.env.HOST_SIGN_IN_URL ?? null,
  ttlSeconds: c.sessions.ttlSeconds,
  hostTtlSeconds: c.hostSessionTtlSeconds,
  secureCookies: c.env.NODE_ENV === 'production',
  embedded: c.embedded,
  throttle: c.loginThrottle,
});

/** One-time call socket tickets, checked against the user's session version on redeem. */
const streamTickets = (c: Container) =>
  createStreamTickets(
    c.env.JWT_SECRET,
    c.clock,
    c.shared.usedTokens.voiceStream,
    sessionVersionsIn(c.db),
  );

/** Every module's routes, mounted under /api/v1. */
export async function registerRoutes(api: FastifyInstance, c: Container) {
  await api.register(authRoutes, authOptions(c));
  await api.register(booksRoutes, { books: c.books });
  await api.register(ticketRoutes, { deps: c.ticketDeps });
  await api.register(draftRoutes, { deps: c.ticketDeps });
  await api.register(managedRoutes);
  await api.register(assistantRoutes, { assistant: c.assistant });
  await api.register(chatRoutes, { chat: c.chat, limits: c.limits });
  await api.register(conversationRoutes, { conversations: c.conversations });
  await api.register(ticketDraftRoutes, { drafts: c.ticketDrafts, limits: c.limits });
  await api.register(voiceRoutes, {
    voice: c.voice,
    voiceFor: c.voiceFor,
    appOrigin: c.env.APP_ORIGIN,
    now: () => c.clock.now(),
    sessions: c.sessions,
    tickets: streamTickets(c),
    publicWsOrigin: c.env.PUBLIC_API_WS_ORIGIN ?? null,
  });
  await api.register(eventRoutes, { events: c.events, sessions: c.sessions });
  await api.register(connectorRoutes, { connectors: c.connectors });
  await api.register(settingsRoutes, { settings: c.settings });
  await api.register(categoryRoutes, { categories: c.categories });
  await api.register(webhookRoutes, { webhooks: c.webhooks });
  await api.register(serverApiRoutes, { server: c.serverApi });
  await api.register(apiKeyRoutes, { workspaces: c.workspaces });
  await api.register(onboardingRoutes, { onboarding: c.onboarding });
  await api.register(workspaceRoutes, {
    workspaces: c.workspaces,
    signupsPerHour: c.env.SIGNUPS_PER_HOUR,
    counters: c.shared.state.counters,
  });
}

/**
 * The super admin console's API (U-7), mounted under /api/v1/platform in its own scope: its own
 * guard and cookie, never the customer session guard. Platform tables are read only here.
 */
export async function registerPlatformRoutes(api: FastifyInstance, c: Container) {
  const pc = c.platformConsole;
  await api.register(platformGuard, { sessions: pc.sessions });
  await api.register(platformAuthRoutes, {
    auth: pc.auth,
    ttlSeconds: pc.sessions.ttlSeconds,
    secureCookies: c.env.NODE_ENV === 'production',
    throttle: c.loginThrottle,
  });
  await api.register(platformConsoleRoutes, { ai: pc.ai, customers: pc.customers });
}
