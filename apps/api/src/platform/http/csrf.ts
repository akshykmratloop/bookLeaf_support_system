import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { ForbiddenError } from '../errors.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence in depth, on top of SameSite=Lax cookies:
 * - a state-changing request that carries an Origin must come from the app's own origin;
 * - only application/json bodies are parsed (the text/plain parser is removed), so a cross-site
 *   HTML form cannot submit a body the API accepts (415).
 */
export const csrfGuard = fp<{ appOrigin: string }>(async (app: FastifyInstance, { appOrigin }) => {
  const allowed = new URL(appOrigin).origin;
  app.removeContentTypeParser('text/plain');
  app.addHook('onRequest', async (req) => {
    if (!UNSAFE.has(req.method)) return;
    const origin = req.headers.origin;
    if (origin !== undefined && origin !== allowed)
      throw new ForbiddenError('Cross-origin request rejected');
  });
});
