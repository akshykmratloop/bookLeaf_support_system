import type { FastifyInstance } from 'fastify';
import type { Container } from './container.js';
import { aiAdminRoutes } from './modules/ai-admin/routes.js';
import { assistantRoutes } from './modules/assistant/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { booksRoutes } from './modules/books/routes.js';
import { chatRoutes } from './modules/chat/routes.js';
import { connectorRoutes } from './modules/connectors/routes.js';
import { conversationRoutes } from './modules/conversations/routes.js';
import { draftRoutes } from './modules/drafts/routes.js';
import { eventRoutes } from './modules/events/routes.js';
import { settingsRoutes } from './modules/settings/routes.js';
import { ticketDraftRoutes } from './modules/ticket-drafts/routes.js';
import { ticketRoutes } from './modules/tickets/routes.js';
import { providerKeyRoutes } from './modules/provider-keys/routes.js';
import { voiceRoutes } from './modules/voice/routes.js';
import { apiKeyRoutes } from './modules/workspaces/api-key-routes.js';
import { workspaceRoutes } from './modules/workspaces/routes.js';

/** Every module's routes, mounted under /api/v1. */
export async function registerRoutes(api: FastifyInstance, c: Container) {
  await api.register(authRoutes, {
    auth: c.auth,
    signInFromHost: c.signInFromHost,
    hostSignInUrl: c.env.HOST_SIGN_IN_URL ?? null,
    ttlSeconds: c.sessions.ttlSeconds,
    secureCookies: c.env.NODE_ENV === 'production',
    embedded: c.embedded,
  });
  await api.register(booksRoutes, { books: c.books });
  await api.register(ticketRoutes, { deps: c.ticketDeps });
  await api.register(draftRoutes, { deps: c.ticketDeps });
  await api.register(aiAdminRoutes, { aiAdmin: c.aiAdmin });
  await api.register(assistantRoutes, { assistant: c.assistant });
  await api.register(chatRoutes, { chat: c.chat, limits: c.limits });
  await api.register(conversationRoutes, { conversations: c.conversations });
  await api.register(ticketDraftRoutes, { drafts: c.ticketDrafts, limits: c.limits });
  await api.register(voiceRoutes, {
    voice: c.voice,
    voiceFor: (workspaceId: string) => c.keyed.voice(workspaceId),
    appOrigin: c.env.APP_ORIGIN,
    now: () => c.clock.now(),
  });
  await api.register(eventRoutes, { events: c.events, sessions: c.sessions });
  await api.register(connectorRoutes, { connectors: c.connectors });
  await api.register(settingsRoutes, { settings: c.settings });
  await api.register(providerKeyRoutes, { providerKeys: c.providerKeys });
  await api.register(apiKeyRoutes, { workspaces: c.workspaces });
  await api.register(workspaceRoutes, {
    workspaces: c.workspaces,
    signupsPerHour: c.env.SIGNUPS_PER_HOUR,
  });
}
