import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  AuditListSchema,
  MyWorkspaceSchema,
  ProblemSchema,
  SignupRequestSchema,
  SignupResponseSchema,
} from '@bookleaf/shared';
import { UsageLimitError } from '../../platform/errors.js';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { RateCounters } from '../../platform/shared-state/types.js';
import { perAddressAndEmail } from '../auth/address-limits.js';
import type { WorkspaceService } from './service.js';

interface Opts {
  workspaces: WorkspaceService;
  signupsPerHour: number;
  /** Shared counters for the platform-wide signup cap. */
  counters: RateCounters;
}

const HOUR_MS = 60 * 60_000;
/** All signups together may be this many times one visitor's hourly limit. */
const PLATFORM_SIGNUP_FACTOR = 10;

/** Bounds mass signups whatever addresses and emails they use (the per-visitor key cannot). */
async function platformSignupCap(counters: RateCounters, signupsPerHour: number): Promise<void> {
  const { count } = await counters.hit('signup:platform', HOUR_MS);
  if (count > signupsPerHour * PLATFORM_SIGNUP_FACTOR)
    throw new UsageLimitError(
      'SIGNUPS_BUSY',
      'Too many new workspaces are being created right now. Please try again in an hour.',
    );
}

const ADMIN = { roles: ['ADMIN'] as const };
const errors = { 401: ProblemSchema, 403: ProblemSchema };

/**
 * Anyone may create a workspace. One visitor (address + email, see address-limits.ts) gets
 * `signupsPerHour` tries; all signups together get ten times that.
 */
function registerSignup(app: RouteApp, { workspaces, signupsPerHour, counters }: Opts) {
  app.post(
    '/signup',
    {
      config: {
        public: true,
        rateLimit: perAddressAndEmail('signup', signupsPerHour, '1 hour'),
      },
      schema: {
        tags: ['workspaces'],
        summary: 'Create a workspace and its owner account',
        body: SignupRequestSchema,
        response: { 201: SignupResponseSchema, 409: ProblemSchema, 422: ProblemSchema },
      },
    },
    async (req, reply) => {
      await platformSignupCap(counters, signupsPerHour);
      return reply.status(201).send(await workspaces.signup(req.body));
    },
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
