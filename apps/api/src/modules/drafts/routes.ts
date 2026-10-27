import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  CheckRequestSchema,
  CheckResultSchema,
  DraftResponseSchema,
  IdParamSchema,
  ProblemSchema,
} from '@bookleaf/shared';
import { sessionOf } from '../../platform/http/auth-guard.js';
import { checkReplyForTicket } from '../messages/service.js';
import type { TicketDeps } from '../tickets/deps.js';
import { findTicketOrThrow } from '../tickets/repository.js';
import { latestDraft, regenerateDraft } from './service.js';

const ADMIN = { roles: ['ADMIN'] as const };
const AI_LIMIT = { max: 20, timeWindow: '1 minute' };

export const draftRoutes: FastifyPluginAsyncZod<{ deps: TicketDeps }> = async (app, { deps }) => {
  app.get(
    '/tickets/:id/draft',
    {
      config: ADMIN,
      schema: {
        tags: ['drafts'],
        summary: 'Latest AI draft with its evidence and check results',
        params: IdParamSchema,
        response: { 200: DraftResponseSchema, 404: ProblemSchema },
      },
    },
    async (req) => latestDraft(deps, sessionOf(req), req.params.id),
  );

  app.post(
    '/tickets/:id/draft/regenerate',
    {
      config: { ...ADMIN, rateLimit: AI_LIMIT },
      schema: {
        tags: ['drafts'],
        summary: 'Queue a new draft (runs in the background)',
        params: IdParamSchema,
        response: { 202: DraftResponseSchema, 404: ProblemSchema },
      },
    },
    async (req, reply) =>
      reply.status(202).send(await regenerateDraft(deps, sessionOf(req), req.params.id)),
  );

  app.post(
    '/tickets/:id/check',
    {
      config: ADMIN,
      schema: {
        tags: ['drafts'],
        summary: 'Check edited reply text against verified facts (no AI call)',
        params: IdParamSchema,
        body: CheckRequestSchema,
        response: { 200: CheckResultSchema, 404: ProblemSchema },
      },
    },
    async (req) => {
      await findTicketOrThrow(deps.db, sessionOf(req), req.params.id);
      return checkReplyForTicket(deps, req.params.id, req.body.body);
    },
  );
};
