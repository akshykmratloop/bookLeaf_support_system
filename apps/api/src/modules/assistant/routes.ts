import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  AssistantAdminStatusSchema,
  AssistantAvailabilitySchema,
  AssistantSettingsSchema,
  ProblemSchema,
  UpdateAssistantSettingsSchema,
} from '@bookleaf/shared';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { AssistantService } from './service.js';

const ADMIN = { roles: ['ADMIN'] as const };
const errors = { 401: ProblemSchema, 403: ProblemSchema, 409: ProblemSchema, 422: ProblemSchema };

export const assistantRoutes: FastifyPluginAsyncZod<{ assistant: AssistantService }> = async (
  app,
  { assistant },
) => {
  app.get(
    '/assistant/availability',
    {
      schema: {
        tags: ['assistant'],
        summary: 'Whether chat and voice are switched on and usable, with the per-author limits',
        response: { 200: AssistantAvailabilitySchema, 401: ProblemSchema },
      },
    },
    async () => assistant.availability(),
  );

  app.get(
    '/admin/assistant',
    {
      config: ADMIN,
      schema: {
        tags: ['assistant'],
        summary: 'Assistant switches, availability and the chat models allowed',
        response: { 200: AssistantAdminStatusSchema, ...errors },
      },
    },
    async () => assistant.adminStatus(),
  );

  app.put(
    '/admin/assistant/settings',
    {
      config: ADMIN,
      schema: {
        tags: ['assistant'],
        summary: 'Switch chat and voice on or off for authors, or choose the chat model',
        body: UpdateAssistantSettingsSchema,
        response: { 200: AssistantSettingsSchema, ...errors },
      },
    },
    async (req) => assistant.update(sessionOf(req), req.body),
  );
};
