import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { AiUsageSchema, ProblemSchema } from '@bookleaf/shared';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { AiUsageService } from './service.js';

interface Opts {
  usage: AiUsageService;
}

/** The workspace admin's AI usage screen. */
export const aiUsageRoutes: FastifyPluginAsyncZod<Opts> = async (app, { usage }) => {
  app.get(
    '/workspace/usage',
    {
      config: { roles: ['ADMIN'] as const },
      schema: {
        tags: ['workspace'],
        summary:
          'AI cost of this workspace over the last 30 days, per feature, in micro-dollars and credits',
        response: { 200: AiUsageSchema, 401: ProblemSchema, 403: ProblemSchema },
      },
    },
    async (req) => usage.forWorkspace(sessionOf(req)),
  );
};
