import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  ConversationDetailSchema,
  ConversationListQuerySchema,
  ConversationPageSchema,
  IdParamSchema,
  ProblemSchema,
} from '@bookleaf/shared';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { ConversationService } from './service.js';

const AUTHOR = { roles: ['AUTHOR'] as const };
const errors = { 401: ProblemSchema, 403: ProblemSchema, 404: ProblemSchema, 422: ProblemSchema };
const tags = ['conversations'];

function registerList(app: RouteApp, conversations: ConversationService) {
  app.get(
    '/conversations',
    {
      config: AUTHOR,
      schema: {
        tags,
        summary: 'My past chats and calls, newest first (cursor paging)',
        querystring: ConversationListQuerySchema,
        response: { 200: ConversationPageSchema, ...errors },
      },
    },
    async (req) => conversations.list(sessionOf(req), req.query),
  );
}

function registerOpen(app: RouteApp, conversations: ConversationService) {
  const detail = (summary: string) => ({
    config: AUTHOR,
    schema: {
      tags,
      summary,
      params: IdParamSchema,
      response: { 200: ConversationDetailSchema, ...errors },
    },
  });
  app.get('/conversations/chats/:id', detail('One of my past chats, read-only'), async (req) =>
    conversations.getChat(sessionOf(req), req.params.id),
  );
  app.get(
    '/conversations/calls/:id',
    detail('One of my past calls (the whole continued thread), read-only'),
    async (req) => conversations.getCall(sessionOf(req), req.params.id),
  );
}

/** Read-only history: an author's own past chats and calls. */
export const conversationRoutes: FastifyPluginAsyncZod<{
  conversations: ConversationService;
}> = async (app, { conversations }) => {
  registerList(app, conversations);
  registerOpen(app, conversations);
};
