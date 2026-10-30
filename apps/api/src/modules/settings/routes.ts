import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CustomerFieldInputSchema,
  CustomerFieldListSchema,
  CustomerFieldSchema,
  IdParamSchema,
  ProblemSchema,
  UpdateWorkspaceSettingsSchema,
  WorkspaceSettingsSchema,
  WorkspaceSettingsStatusSchema,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import { refuseManagedFields } from '../managed/routes.js';
import type { SettingsService } from './service.js';

interface Opts {
  settings: SettingsService;
}

const ADMIN = { roles: ['ADMIN'] as const };
const errors = { 401: ProblemSchema, 403: ProblemSchema, 409: ProblemSchema, 422: ProblemSchema };
const tags = ['workspace'];

function registerSettings(app: RouteApp, { settings }: Opts) {
  app.get(
    '/workspace/settings',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'AI behaviour, chat, voice and widget settings of this workspace, and its plan',
        response: { 200: WorkspaceSettingsStatusSchema, ...errors },
      },
    },
    async (req) => settings.status(sessionOf(req)),
  );
  app.put(
    '/workspace/settings',
    {
      config: ADMIN,
      preValidation: refuseManagedFields,
      schema: {
        tags,
        summary: 'Change any of the workspace settings (send the version you last saw)',
        body: UpdateWorkspaceSettingsSchema,
        response: { 200: WorkspaceSettingsSchema, ...errors },
      },
    },
    async (req) => settings.update(sessionOf(req), req.body),
  );
}

function registerFieldReads(app: RouteApp, { settings }: Opts) {
  const { fields } = settings;
  app.get(
    '/workspace/fields',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'The customer-data fields this workspace’s product sends',
        response: { 200: CustomerFieldListSchema, ...errors },
      },
    },
    async (req) => fields.list(sessionOf(req)),
  );
  app.post(
    '/workspace/fields',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Define a customer-data field',
        body: CustomerFieldInputSchema,
        response: { 201: CustomerFieldSchema, ...errors },
      },
    },
    async (req, reply) => reply.status(201).send(await fields.create(sessionOf(req), req.body)),
  );
}

function registerFieldWrites(app: RouteApp, { settings }: Opts) {
  const { fields } = settings;
  app.put(
    '/workspace/fields/:id',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Change a customer-data field',
        params: IdParamSchema,
        body: CustomerFieldInputSchema,
        response: { 200: CustomerFieldSchema, 404: ProblemSchema, ...errors },
      },
    },
    async (req) => fields.update(sessionOf(req), req.params.id, req.body),
  );
  app.delete(
    '/workspace/fields/:id',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Remove a customer-data field',
        params: IdParamSchema,
        response: { 204: z.null(), 404: ProblemSchema, ...errors },
      },
    },
    async (req, reply) => {
      await fields.remove(sessionOf(req), req.params.id);
      return reply.status(204).send(null);
    },
  );
}

export const settingsRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  registerSettings(app, opts);
  registerFieldReads(app, opts);
  registerFieldWrites(app, opts);
};
