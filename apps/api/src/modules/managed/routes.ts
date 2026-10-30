import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { MANAGED_SETTING_KEYS, ProblemSchema } from '@bookleaf/shared';
import { ForbiddenError } from '../../platform/errors.js';
import '../../platform/http/augment.js';

/**
 * Settings the support provider controls (U-7): providers, models, keys and the outage switch.
 * The old customer endpoints stay registered so old screens and scripts get a clear 403 from
 * the server instead of a confusing 404, whoever calls them.
 */
export const managedBySupportProvider = () =>
  new ForbiddenError('Managed by your support provider');

/** preValidation hook: a body that tries to set a managed field is refused before anything else. */
export async function refuseManagedFields(req: FastifyRequest): Promise<void> {
  const body = req.body;
  if (typeof body !== 'object' || body === null) return;
  if (MANAGED_SETTING_KEYS.some((key) => key in body)) throw managedBySupportProvider();
}

const ADMIN = { roles: ['ADMIN'] as const };
const schema = {
  tags: ['workspace'],
  summary: 'Managed by your support provider (always 403)',
  response: { 401: ProblemSchema, 403: ProblemSchema },
};

const OLD_ROUTES = [
  ['GET', '/admin/ai/status'],
  ['GET', '/admin/ai/settings'],
  ['PUT', '/admin/ai/settings'],
  ['POST', '/admin/ai/test'],
  ['GET', '/workspace/provider-keys'],
  ['PUT', '/workspace/provider-keys/:capability'],
  ['DELETE', '/workspace/provider-keys/:capability'],
] as const;

export const managedRoutes: FastifyPluginAsyncZod = async (app) => {
  for (const [method, url] of OLD_ROUTES)
    app.route({
      method,
      url,
      config: ADMIN,
      schema,
      handler: async () => {
        throw managedBySupportProvider();
      },
    });
};
