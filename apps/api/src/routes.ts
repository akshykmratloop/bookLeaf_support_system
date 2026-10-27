import type { FastifyInstance } from 'fastify';
import type { Container } from './container.js';
import { aiAdminRoutes } from './modules/ai-admin/routes.js';
import { assistantRoutes } from './modules/assistant/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { booksRoutes } from './modules/books/routes.js';
import { chatRoutes } from './modules/chat/routes.js';
import { conversationRoutes } from './modules/conversations/routes.js';
import { draftRoutes } from './modules/drafts/routes.js';
import { eventRoutes } from './modules/events/routes.js';
import { ticketDraftRoutes } from './modules/ticket-drafts/routes.js';
import { ticketRoutes } from './modules/tickets/routes.js';
import { voiceRoutes } from './modules/voice/routes.js';

/** Every module's routes, mounted under /api/v1. */
export async function registerRoutes(api: FastifyInstance, c: Container) {
  await api.register(authRoutes, {
    auth: c.auth,
    signInFromHost: c.signInFromHost,
    hostSignInUrl: c.env.HOST_SIGN_IN_URL ?? null,
    ttlSeconds: c.sessions.ttlSeconds,
    secureCookies: c.env.NODE_ENV === 'production',
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
    provider: c.voiceProvider,
    appOrigin: c.env.APP_ORIGIN,
    now: () => c.clock.now(),
  });
  await api.register(eventRoutes, { events: c.events, sessions: c.sessions });
}
