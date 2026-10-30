import { IdParamSchema, ProblemSchema, TicketCustomerSchema } from '@bookleaf/shared';
import type { RouteApp } from '../../platform/http/route-app.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import { getTicketCustomer } from './customer.js';
import type { TicketDeps } from './deps.js';

/** Staff only (403 for authors): the Customer panel on the ticket page (U-1). */
export function ticketCustomerRoute(app: RouteApp, deps: TicketDeps) {
  app.get(
    '/tickets/:id/customer',
    {
      config: { roles: ['ADMIN'] as const },
      schema: {
        tags: ['tickets'],
        summary:
          "The ticket's customer: profile, record lines (labelled by the workspace's customer data fields) and their other tickets here",
        params: IdParamSchema,
        response: {
          200: TicketCustomerSchema,
          401: ProblemSchema,
          403: ProblemSchema,
          404: ProblemSchema,
        },
      },
    },
    async (req) => getTicketCustomer(deps, sessionOf(req), req.params.id),
  );
}
