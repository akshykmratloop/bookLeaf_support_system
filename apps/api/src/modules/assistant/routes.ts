import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { RouteApp } from '../../platform/http/route-app.js';
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
interface Deps {
  assistant: AssistantService;
}
const errors = { 401: ProblemSchema, 403: ProblemSchema, 409: ProblemSchema, 422: ProblemSchema };

/** Any signed-in user: is chat or voice usable right now? */
function registerAvailability(app: RouteApp, { assistant }: Deps) {
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
}

/** Admins read and change the switches. */
function registerAdminRoutes(app: RouteApp, { assistant }: Deps) {
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
}

export const assistantRoutes: FastifyPluginAsyncZod<Deps> = async (app, deps) => {
  registerAvailability(app, deps);
  registerAdminRoutes(app, deps);
};
