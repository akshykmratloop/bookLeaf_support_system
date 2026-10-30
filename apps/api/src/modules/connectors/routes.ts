import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  ConnectorSchema,
  ConnectorTestRequestSchema,
  ConnectorTestResultSchema,
  ProblemSchema,
  SaveConnectorRequestSchema,
  SaveRecordMappingRequestSchema,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { ConnectorService } from './service.js';

interface Opts {
  connectors: ConnectorService;
}

const ADMIN = { roles: ['ADMIN'] as const };
const errors = { 401: ProblemSchema, 403: ProblemSchema, 409: ProblemSchema, 422: ProblemSchema };
/** Testing hits the tenant's product; keep it to a few tries a minute per workspace. */
const TEST_LIMIT = { max: 10, timeWindow: '1 minute' };

function registerRead(app: RouteApp, { connectors }: Opts) {
  app.get(
    '/workspace/connector',
    {
      config: ADMIN,
      schema: {
        tags: ['workspace'],
        summary: 'How customer data is fetched from your product (secrets shown as hints)',
        response: { 200: ConnectorSchema, ...errors },
      },
    },
    async (req) => connectors.get(sessionOf(req)),
  );
}

function registerWrite(app: RouteApp, { connectors }: Opts) {
  app.put(
    '/workspace/connector',
    {
      config: ADMIN,
      schema: {
        tags: ['workspace'],
        summary: 'Set the data sources, API key and signing secret (secrets are write-only)',
        body: SaveConnectorRequestSchema,
        response: { 200: ConnectorSchema, 503: ProblemSchema, ...errors },
      },
    },
    async (req) => connectors.save(sessionOf(req), req.body),
  );
  app.post(
    '/workspace/connector/test',
    {
      config: { ...ADMIN, rateLimit: TEST_LIMIT },
      schema: {
        tags: ['workspace'],
        summary: 'Call every data source for one customer: raw answers and the merged record',
        body: ConnectorTestRequestSchema,
        response: { 200: ConnectorTestResultSchema, ...errors },
      },
    },
    async (req) => connectors.test(sessionOf(req), req.body.customerId, req.body.email),
  );
}

function registerMapping(app: RouteApp, { connectors }: Opts) {
  app.put(
    '/workspace/connector/mapping',
    {
      config: ADMIN,
      schema: {
        tags: ['workspace'],
        summary: 'Where the customer name, email and item list come from in your data sources',
        body: SaveRecordMappingRequestSchema,
        response: { 200: ConnectorSchema, ...errors },
      },
    },
    async (req) => connectors.saveMapping(sessionOf(req), req.body),
  );
}

export const connectorRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  registerRead(app, opts);
  registerWrite(app, opts);
  registerMapping(app, opts);
};
