import type { ServerTicketQuery } from '@bookleaf/shared';
import type { FastifyRequest } from 'fastify';
import type { Db } from '../../platform/db.js';
import { withWorkspace } from '../../platform/tenancy.js';
import { requireKey, type VerifyKey } from './api-key-auth.js';
import { getServerTicket, listServerTickets } from './queries.js';

/**
 * The workspace's own server reads its tickets; the API key decides the workspace, and the reads
 * then run as that workspace (row-level security, S.8).
 */
export function createServerApiService(db: Db, verify: VerifyKey) {
  return {
    async listTickets(req: FastifyRequest, q: ServerTicketQuery) {
      const { workspaceId } = await requireKey(req, verify, 'tickets:read');
      return withWorkspace(workspaceId, () => listServerTickets(db, workspaceId, q));
    },
    async getTicket(req: FastifyRequest, id: string) {
      const { workspaceId } = await requireKey(req, verify, 'tickets:read');
      return withWorkspace(workspaceId, () => getServerTicket(db, workspaceId, id));
    },
  };
}

export type ServerApiService = ReturnType<typeof createServerApiService>;
