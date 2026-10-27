import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ProblemSchema,
  ProviderCapabilityParamSchema,
  ProviderKeyListSchema,
  ProviderKeySchema,
  SaveProviderKeySchema,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { ProviderKeyService } from './service.js';

interface Opts {
  providerKeys: ProviderKeyService;
}

const ADMIN = { roles: ['ADMIN'] as const };
const errors = {
  401: ProblemSchema,
  403: ProblemSchema,
  404: ProblemSchema,
  422: ProblemSchema,
  503: ProblemSchema,
};
const tags = ['workspace'];

function registerList(app: RouteApp, { providerKeys }: Opts) {
  app.get(
    '/workspace/provider-keys',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: "This workspace's own provider keys (last 4 characters only)",
        response: { 200: ProviderKeyListSchema, ...errors },
      },
    },
    async (req) => providerKeys.list(sessionOf(req)),
  );
}

function registerWrites(app: RouteApp, { providerKeys }: Opts) {
  app.put(
    '/workspace/provider-keys/:capability',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Save or replace the key used for AI or for voice calls',
        params: ProviderCapabilityParamSchema,
        body: SaveProviderKeySchema,
        response: { 200: ProviderKeySchema, ...errors },
      },
    },
    async (req) => providerKeys.save(sessionOf(req), req.params.capability, req.body),
  );
  app.delete(
    '/workspace/provider-keys/:capability',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: "Remove the workspace's own key (it goes back to the platform's)",
        params: ProviderCapabilityParamSchema,
        response: { 204: z.null(), ...errors },
      },
    },
    async (req, reply) => {
      await providerKeys.remove(sessionOf(req), req.params.capability);
      return reply.status(204).send(null);
    },
  );
}

/** The workspace's own AI and voice provider keys (admins only; keys are write-only). */
export const providerKeyRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  registerList(app, opts);
  registerWrites(app, opts);
};
