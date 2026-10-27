import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  AiSettingsSchema,
  AiStatusSchema,
  AiTestResultSchema,
  ProblemSchema,
  UpdateAiSettingsSchema,
} from '@bookleaf/shared';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { AiAdminService } from './service.js';

const ADMIN = { roles: ['ADMIN'] as const };
const errors = { 401: ProblemSchema, 403: ProblemSchema, 409: ProblemSchema, 422: ProblemSchema };

export const aiAdminRoutes: FastifyPluginAsyncZod<{ aiAdmin: AiAdminService }> = async (
  app,
  { aiAdmin },
) => {
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
};
