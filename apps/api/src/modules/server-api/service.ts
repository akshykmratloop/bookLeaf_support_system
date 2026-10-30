import type { ServerCreateTicket, ServerStatusChange, ServerTicketQuery } from '@bookleaf/shared';
import type { FastifyRequest } from 'fastify';
import { idempotencyKey } from '../../platform/http/idempotency.js';
import { withWorkspace } from '../../platform/tenancy.js';
import type { TicketDeps } from '../tickets/deps.js';
import { requireKey, type VerifyKey } from './api-key-auth.js';
import { knownCustomerId } from './customers.js';
import { getServerTicket, listServerTickets } from './queries.js';
import { addServerMessage, changeServerStatus, createServerTicket } from './writes.js';

/** Writes need `tickets:write`; the key is checked before the Idempotency-Key header (401 first). */
const writer = async (req: FastifyRequest, verify: VerifyKey) => ({
  grant: await requireKey(req, verify, 'tickets:write'),
  key: idempotencyKey(req),
});

/**
 * The workspace's own server reads and changes its tickets; the API key decides the workspace and
 * what it may do (scopes, U-11), and the work then runs as that workspace (row-level security, S.8).
 */
export function createServerApiService(deps: TicketDeps, verify: VerifyKey) {
  const { db } = deps;
  return {
    async listTickets(req: FastifyRequest, q: ServerTicketQuery) {
      const { workspaceId } = await requireKey(req, verify, 'tickets:read');
      return withWorkspace(workspaceId, () => listServerTickets(db, workspaceId, q));
    },
    async getTicket(req: FastifyRequest, id: string) {
      const { workspaceId } = await requireKey(req, verify, 'tickets:read');
      return withWorkspace(workspaceId, () => getServerTicket(db, workspaceId, id));
    },
    async customerTickets(req: FastifyRequest, customerId: string, q: ServerTicketQuery) {
      const { workspaceId } = await requireKey(req, verify, 'customers:read');
      return withWorkspace(workspaceId, async () => {
        const authorId = await knownCustomerId(db, workspaceId, customerId);
        return listServerTickets(db, workspaceId, q, authorId);
      });
    },
    async createTicket(req: FastifyRequest, input: ServerCreateTicket) {
      const { grant, key } = await writer(req, verify);
      return withWorkspace(grant.workspaceId, () => createServerTicket(deps, grant, input, key));
    },
    async addMessage(req: FastifyRequest, ticketId: string, body: string) {
      const { grant, key } = await writer(req, verify);
      const message = { body, idempotencyKey: key };
      return withWorkspace(grant.workspaceId, () =>
        addServerMessage(deps, grant, ticketId, message),
      );
    },
    async changeStatus(req: FastifyRequest, ticketId: string, change: ServerStatusChange) {
      const { grant, key } = await writer(req, verify);
      const input = { ...change, idempotencyKey: key };
      return withWorkspace(grant.workspaceId, () =>
        changeServerStatus(deps, grant, ticketId, input),
      );
    },
  };
}

export type ServerApiService = ReturnType<typeof createServerApiService>;
