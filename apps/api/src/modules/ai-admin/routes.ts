import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { RouteApp } from '../../platform/http/route-app.js';
import {
  AiSettingsSchema,
  AiStatusSchema,
  AiTestResultSchema,
  ProblemSchema,
  UpdateAiSettingsSchema,
} from '@bookleaf/shared';
import type { FastifyRequest } from 'fastify';
import { ForbiddenError } from '../../platform/errors.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import { DEFAULT_WORKSPACE_ID } from '../workspaces/constants.js';
import type { AiAdminService } from './service.js';

const ADMIN = { roles: ['ADMIN'] as const };

/**
 * The platform's AI provider, models and outage switch apply to every workspace, so only the
 * platform operator (an admin of the default workspace) may see or change them. Other
 * workspaces choose their own models in their workspace settings.
 */
async function platformOperatorOnly(req: FastifyRequest) {
  if (sessionOf(req).workspaceId !== DEFAULT_WORKSPACE_ID)
    throw new ForbiddenError('Platform AI settings are managed by the platform operator');
}
interface Deps {
  aiAdmin: AiAdminService;
}
const errors = { 401: ProblemSchema, 403: ProblemSchema, 409: ProblemSchema, 422: ProblemSchema };

/** Reading the current AI choice and provider status. */
function registerReadRoutes(app: RouteApp, { aiAdmin }: Deps) {
  app.get(
    '/admin/ai/status',
    {
      config: ADMIN,
      schema: {
        tags: ['ai-admin'],
        summary: 'Active provider/models, which providers have keys, last test',
        response: { 200: AiStatusSchema, ...errors },
      },
    },
    async () => aiAdmin.status(),
  );

  app.get(
    '/admin/ai/settings',
    {
      config: ADMIN,
      schema: {
        tags: ['ai-admin'],
        summary: 'Current AI settings',
        response: { 200: AiSettingsSchema, ...errors },
      },
    },
    async () => (await aiAdmin.status()).settings,
  );
}

/** Changing the AI choice and testing the provider. */
function registerChangeRoutes(app: RouteApp, { aiAdmin }: Deps) {
  app.put(
    '/admin/ai/settings',
    {
      config: ADMIN,
      schema: {
        tags: ['ai-admin'],
        summary: 'Choose provider and models (allowlist) or toggle the outage simulation',
        body: UpdateAiSettingsSchema,
        response: { 200: AiSettingsSchema, ...errors },
      },
    },
    async (req) => aiAdmin.update(sessionOf(req), req.body),
  );

  app.post(
    '/admin/ai/test',
    {
      config: { ...ADMIN, rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        tags: ['ai-admin'],
        summary: 'Send a tiny test request to the active provider',
        response: { 200: AiTestResultSchema, ...errors },
      },
    },
    async () => aiAdmin.test(),
  );
}

export const aiAdminRoutes: FastifyPluginAsyncZod<Deps> = async (app, deps) => {
  app.addHook('preHandler', platformOperatorOnly);
  registerReadRoutes(app, deps);
  registerChangeRoutes(app, deps);
};
