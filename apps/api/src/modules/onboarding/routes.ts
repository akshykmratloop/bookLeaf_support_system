import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  OnboardingStatusSchema,
  OnboardingTestTicketSchema,
  ProblemSchema,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { OnboardingService } from './service.js';

interface Opts {
  onboarding: OnboardingService;
}

const ADMIN = { roles: ['ADMIN'] as const };
const errors = { 401: ProblemSchema, 403: ProblemSchema, 404: ProblemSchema };
const tags = ['workspace'];
/** Each test ticket runs triage and webhooks: a few a minute is plenty. */
const TEST_TICKET_LIMIT = { max: 5, timeWindow: '1 minute' };

/** The admin "Get started" guide: where setup stands, and a ticket to test the queue with. */
export const onboardingRoutes: FastifyPluginAsyncZod<Opts> = async (app, { onboarding }) => {
  app.get(
    '/workspace/onboarding',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Setup guide: each step checked on the server (done, to do or broken)',
        response: { 200: OnboardingStatusSchema, ...errors },
      },
    },
    async (req) => onboarding.status(sessionOf(req)),
  );
  app.post(
    '/workspace/onboarding/test-ticket',
    {
      config: { ...ADMIN, rateLimit: TEST_TICKET_LIMIT },
      schema: {
        tags,
        summary: 'Send a test ticket from a test customer (it never ticks "Test it")',
        response: {
          201: OnboardingTestTicketSchema,
          409: ProblemSchema,
          429: ProblemSchema,
          ...errors,
        },
      },
    },
    async (req, reply) => reply.status(201).send(await onboarding.sendTestTicket(sessionOf(req))),
  );
};
