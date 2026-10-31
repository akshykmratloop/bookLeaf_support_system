import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreatedWebhookSchema,
  CreateWebhookRequestSchema,
  IdParamSchema,
  ProblemSchema,
  UpdateWebhookRequestSchema,
  WebhookDeliveryListSchema,
  WebhookDeliveryParamsSchema,
  WebhookDeliverySchema,
  WebhookListSchema,
  WebhookSchema,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { WebhookService } from './service.js';

interface Opts {
  webhooks: WebhookService;
}

const ADMIN = { roles: ['ADMIN'] as const };
/** Changes to credentials and integrations: the workspace owner only (other staff may read). */
const OWNER = { ...ADMIN, workspaceRoles: ['OWNER'] as const };
const errors = {
  401: ProblemSchema,
  403: ProblemSchema,
  404: ProblemSchema,
  409: ProblemSchema,
  422: ProblemSchema,
  503: ProblemSchema,
};
const tags = ['workspace'];

function registerManage(app: RouteApp, { webhooks }: Opts) {
  app.get(
    '/workspace/webhooks',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Webhooks of this workspace',
        response: { 200: WebhookListSchema, ...errors },
      },
    },
    async (req) => webhooks.list(sessionOf(req)),
  );
  app.post(
    '/workspace/webhooks',
    {
      config: OWNER,
      schema: {
        tags,
        summary: 'Add a webhook; its signing secret is returned once',
        body: CreateWebhookRequestSchema,
        response: { 201: CreatedWebhookSchema, ...errors },
      },
    },
    async (req, reply) => reply.status(201).send(await webhooks.create(sessionOf(req), req.body)),
  );
}

function registerRemove(app: RouteApp, { webhooks }: Opts) {
  app.delete(
    '/workspace/webhooks/:id',
    {
      config: OWNER,
      schema: {
        tags,
        summary: 'Remove a webhook',
        params: IdParamSchema,
        response: { 204: z.null(), ...errors },
      },
    },
    async (req, reply) => {
      await webhooks.remove(sessionOf(req), req.params.id);
      return reply.status(204).send(null);
    },
  );
}

function registerEdit(app: RouteApp, { webhooks }: Opts) {
  app.patch(
    '/workspace/webhooks/:id',
    {
      config: OWNER,
      schema: {
        tags,
        summary: 'Edit a webhook: address, events, or switch it on or off',
        params: IdParamSchema,
        body: UpdateWebhookRequestSchema,
        response: { 200: WebhookSchema, ...errors },
      },
    },
    async (req) => webhooks.update(sessionOf(req), req.params.id, req.body),
  );
  app.post(
    '/workspace/webhooks/:id/rotate-secret',
    {
      config: OWNER,
      schema: {
        tags,
        summary: 'Replace the signing secret; the new one is returned once',
        params: IdParamSchema,
        response: { 200: CreatedWebhookSchema, ...errors },
      },
    },
    async (req) => webhooks.rotateSecret(sessionOf(req), req.params.id),
  );
}

function registerDeliveries(app: RouteApp, { webhooks }: Opts) {
  app.post(
    '/workspace/webhooks/:id/test',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Queue a signed test delivery',
        params: IdParamSchema,
        response: { 202: WebhookDeliverySchema, ...errors },
      },
    },
    async (req, reply) =>
      reply.status(202).send(await webhooks.test(sessionOf(req), req.params.id)),
  );
  app.get(
    '/workspace/webhooks/:id/deliveries',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'The 20 latest deliveries of a webhook',
        params: IdParamSchema,
        response: { 200: WebhookDeliveryListSchema, ...errors },
      },
    },
    async (req) => webhooks.deliveries(sessionOf(req), req.params.id),
  );
}

function registerRetry(app: RouteApp, { webhooks }: Opts) {
  app.post(
    '/workspace/webhooks/:id/deliveries/:deliveryId/retry',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Send a failed delivery again',
        params: WebhookDeliveryParamsSchema,
        response: { 202: WebhookDeliverySchema, ...errors },
      },
    },
    async (req, reply) =>
      reply
        .status(202)
        .send(await webhooks.retry(sessionOf(req), req.params.id, req.params.deliveryId)),
  );
}

export const webhookRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  registerManage(app, opts);
  registerRemove(app, opts);
  registerEdit(app, opts);
  registerDeliveries(app, opts);
  registerRetry(app, opts);
};
