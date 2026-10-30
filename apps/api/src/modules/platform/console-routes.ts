import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AiTestResultSchema,
  CreateCustomerSchema,
  CustomerIdParamSchema,
  CustomerListSchema,
  PlanStatusSchema,
  PlatformAiSettingsSchema,
  PlatformAiStatusSchema,
  PlatformKeyParamsSchema,
  ProblemSchema,
  SavePlatformKeySchema,
  UpdatePlanSchema,
  UpdatePlatformAiSettingsSchema,
} from '@bookleaf/shared';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { PlatformAiAdmin } from './ai-admin.js';
import type { CustomerService } from './customers.js';

interface Opts {
  ai: PlatformAiAdmin;
  customers: CustomerService;
}

const tags = ['platform'];
const errors = {
  401: ProblemSchema,
  403: ProblemSchema,
  404: ProblemSchema,
  409: ProblemSchema,
  422: ProblemSchema,
  503: ProblemSchema,
};

function registerAi(app: RouteApp, { ai }: Opts) {
  app.get(
    '/ai',
    {
      schema: {
        tags,
        summary: 'Platform AI settings and where each key comes from',
        response: { 200: PlatformAiStatusSchema, ...errors },
      },
    },
    async () => ai.status(),
  );
  app.put(
    '/ai/settings',
    {
      schema: {
        tags,
        summary: 'Provider, models for triage/draft/chat/voice, and the global outage switch',
        body: UpdatePlatformAiSettingsSchema,
        response: { 200: PlatformAiSettingsSchema, ...errors },
      },
    },
    async (req) => ai.update(req.body),
  );
  app.post(
    '/ai/test',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        tags,
        summary: 'Send a tiny test request with the active key',
        response: { 200: AiTestResultSchema, ...errors },
      },
    },
    async () => ai.test(),
  );
}

function registerKeys(app: RouteApp, { ai }: Opts) {
  app.put(
    '/ai/keys/:capability/:provider',
    {
      schema: {
        tags,
        summary: 'Save or replace a provider key (encrypted; it wins over the env key)',
        params: PlatformKeyParamsSchema,
        body: SavePlatformKeySchema,
        response: { 200: PlatformAiStatusSchema, ...errors },
      },
    },
    async (req) => ai.saveKey(req.params.capability, req.params.provider, req.body),
  );
  app.delete(
    '/ai/keys/:capability/:provider',
    {
      schema: {
        tags,
        summary: 'Remove a saved key (the env key, if any, is used again)',
        params: PlatformKeyParamsSchema,
        response: { 204: z.null(), ...errors },
      },
    },
    async (req, reply) => {
      await ai.removeKey(req.params.capability, req.params.provider);
      return reply.status(204).send(null);
    },
  );
}

function registerCustomers(app: RouteApp, { customers }: Opts) {
  app.get(
    '/customers',
    {
      schema: {
        tags,
        summary: 'Every customer with plan, counts, usage and AI cost (no ticket content)',
        response: { 200: CustomerListSchema, ...errors },
      },
    },
    async () => customers.list(),
  );
  app.post(
    '/customers',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
      schema: {
        tags,
        summary: 'Create a customer: a workspace and its first owner',
        body: CreateCustomerSchema,
        response: { 201: z.object({ id: z.uuid(), slug: z.string() }), ...errors },
      },
    },
    async (req, reply) => reply.status(201).send(await customers.create(req.body)),
  );
  app.put(
    '/customers/:id/plan',
    {
      schema: {
        tags,
        summary: 'Change what a customer may use, switch its AI off, or suspend it',
        params: CustomerIdParamSchema,
        body: UpdatePlanSchema,
        response: { 200: PlanStatusSchema, ...errors },
      },
    },
    async (req) => customers.updatePlan(req.params.id, req.body),
  );
}

/** The console's AI and customer screens (U-7). The platform guard has already checked the session. */
export const platformConsoleRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  registerAi(app, opts);
  registerKeys(app, opts);
  registerCustomers(app, opts);
};
