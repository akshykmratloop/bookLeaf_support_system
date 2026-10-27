import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { HostCustomerSchema } from '@bookleaf/shared';
import { z } from 'zod';
import { findById, type AuthorAccount } from '../data/authors.js';
import { toCustomer } from '../customers.js';
import { sameSecret } from '../secrets.js';

/** True when the request carries the host's API key as a Bearer token. */
export function hasApiKey(header: string | undefined, apiKey: string): boolean {
  return sameSecret(header?.startsWith('Bearer ') ? header.slice(7) : '', apiKey);
}

const ErrorSchema = z.object({ error: z.string() });

interface Options {
  authors: AuthorAccount[];
  apiKey: string;
  dataAsOf: Date;
}

/** The one endpoint the support module calls: everything it may know about a customer. */
export const customerRoutes: FastifyPluginAsyncZod<Options> = async (app, opts) => {
  app.get(
    '/support/customers/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1).max(100) }),
        response: { 200: HostCustomerSchema, 401: ErrorSchema, 404: ErrorSchema },
      },
    },
    async (req, reply) => {
      if (!hasApiKey(req.headers.authorization, opts.apiKey))
        return reply.status(401).send({ error: 'Invalid API key' });
      const account = findById(opts.authors, req.params.id);
      if (!account) return reply.status(404).send({ error: 'Unknown customer' });
      return toCustomer(account, opts.dataAsOf);
    },
  );
};
