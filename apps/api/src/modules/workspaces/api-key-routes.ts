import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  ApiKeyListSchema,
  ApiKeySchema,
  CreateApiKeyRequestSchema,
  CreatedApiKeySchema,
  IdParamSchema,
  ProblemSchema,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { WorkspaceService } from './service.js';

interface Opts {
  workspaces: WorkspaceService;
}

const ADMIN = { roles: ['ADMIN'] as const };
const errors = { 401: ProblemSchema, 403: ProblemSchema, 404: ProblemSchema, 422: ProblemSchema };
const tags = ['workspace'];

function registerKeys(app: RouteApp, { workspaces }: Opts) {
  app.get(
    '/workspace/api-keys',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'API keys of this workspace',
        response: { 200: ApiKeyListSchema, ...errors },
      },
    },
    async (req) => ({ items: await workspaces.apiKeys.list(sessionOf(req)) }),
  );
  app.post(
    '/workspace/api-keys',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Create an API key (the plain key is shown once)',
        body: CreateApiKeyRequestSchema,
        response: { 201: CreatedApiKeySchema, ...errors },
      },
    },
    async (req, reply) =>
      reply.status(201).send(await workspaces.apiKeys.create(sessionOf(req), req.body)),
  );
}

function registerRevoke(app: RouteApp, { workspaces }: Opts) {
  app.delete(
    '/workspace/api-keys/:id',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Revoke an API key',
        params: IdParamSchema,
        response: { 200: ApiKeySchema, ...errors },
      },
    },
    async (req) => workspaces.apiKeys.revoke(sessionOf(req), req.params.id),
  );
}

export const apiKeyRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  registerKeys(app, opts);
  registerRevoke(app, opts);
};
