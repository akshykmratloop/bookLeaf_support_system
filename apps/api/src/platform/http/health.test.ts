import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../db.js';
import { SharedStateUnavailableError } from '../shared-state/errors.js';
import { registerErrorHandler } from './error-handler.js';
import { healthRoutes } from './health.js';

let app: FastifyInstance | null = null;
afterEach(async () => {
  await app?.close();
  app = null;
});

const fail = () => Promise.reject(new Error('unreachable'));
const pass = () => Promise.resolve();

async function healthApp(dbUp: boolean, redisUp: boolean) {
  const db = { $queryRaw: () => (dbUp ? Promise.resolve([{ ok: 1 }]) : fail()) };
  app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(healthRoutes, {
    db: db as unknown as Db,
    shared: { ready: redisUp ? pass : fail },
  });
  return app.inject({ method: 'GET', url: '/health' });
}

describe('GET /health', () => {
  it('is 200 when the database and Redis both answer', async () => {
    const res = await healthApp(true, true);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', database: 'ok', redis: 'ok' });
  });

  it('is 503 with redis "down" when Redis does not answer', async () => {
    const res = await healthApp(true, false);
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'degraded', database: 'ok', redis: 'down' });
  });

  it('is 503 with database "down" when the database does not answer', async () => {
    const res = await healthApp(false, true);
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'degraded', database: 'down', redis: 'ok' });
  });
});

async function failingWith(err: Error) {
  app = Fastify();
  registerErrorHandler(app);
  app.get('/boom', async () => {
    throw err;
  });
  return app.inject({ method: 'GET', url: '/boom' });
}

const namedError = (name: string, message: string) => {
  const err = new Error(message);
  err.name = name;
  return err;
};

describe('Redis outages are a 503, not a 500', () => {
  it.each([
    ['SharedStateUnavailableError', new SharedStateUnavailableError('Cannot reach Redis')],
    ['ioredis retries exhausted', namedError('MaxRetriesPerRequestError', 'Reached the max')],
    ['ioredis connection closed', new Error('Connection is closed.')],
  ])('%s', async (_label, err) => {
    const res = await failingWith(err);
    expect(res.statusCode).toBe(503);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE' });
    expect(res.body).not.toContain('Redis');
  });

  it('any other unexpected error stays a 500', async () => {
    const res = await failingWith(new Error('something else'));
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ code: 'INTERNAL' });
  });
});
