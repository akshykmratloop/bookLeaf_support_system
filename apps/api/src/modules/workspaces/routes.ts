import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  AuditListSchema,
  MyWorkspaceSchema,
  ProblemSchema,
  SignupRequestSchema,
  SignupResponseSchema,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { WorkspaceService } from './service.js';

interface Opts {
  workspaces: WorkspaceService;
  signupsPerHour: number;
}

const ADMIN = { roles: ['ADMIN'] as const };
const errors = { 401: ProblemSchema, 403: ProblemSchema };

/** Anyone may create a workspace; the limit stops one address from creating many. */
function registerSignup(app: RouteApp, { workspaces, signupsPerHour }: Opts) {
  app.post(
    '/signup',
    {
      config: { public: true, rateLimit: { max: signupsPerHour, timeWindow: '1 hour' } },
      schema: {
        tags: ['workspaces'],
        summary: 'Create a workspace and its owner account',
        body: SignupRequestSchema,
        response: { 201: SignupResponseSchema, 409: ProblemSchema, 422: ProblemSchema },
      },
    },
    async (req, reply) => reply.status(201).send(await workspaces.signup(req.body)),
  );
}

/** Staff read their own workspace and its change log. */
function registerWorkspace(app: RouteApp, { workspaces }: Opts) {
  app.get(
    '/workspace',
    {
      config: ADMIN,
      schema: {
        tags: ['workspaces'],
        summary: 'The signed-in staff member’s workspace and role',
        response: { 200: MyWorkspaceSchema, ...errors },
      },
    },
    async (req) => workspaces.mine(sessionOf(req)),
  );
  app.get(
    '/workspace/audit',
    {
      config: ADMIN,
      schema: {
        tags: ['workspaces'],
        summary: 'Recent configuration and ticket changes in this workspace',
        response: { 200: AuditListSchema, ...errors },
      },
    },
    async (req) => workspaces.audit(sessionOf(req)),
  );
}

export const workspaceRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  registerSignup(app, opts);
  registerWorkspace(app, opts);
};
