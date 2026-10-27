import {
  HOST_TOKEN_AUDIENCE,
  HOST_TOKEN_MAX_SECONDS,
  HostCustomerSchema,
  HostTokenClaimsSchema,
} from '@bookleaf/shared';
import type { FastifyInstance } from 'fastify';
import { jwtVerify } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildHostApp } from '../src/app.js';
import { AUTHORS, TEST_CONFIG } from './fixtures.js';

let app: FastifyInstance;
const bearer = { authorization: `Bearer ${TEST_CONFIG.HOST_API_KEY}` };
const customer = (id: string, headers: Record<string, string> = bearer) =>
  app.inject({ method: 'GET', url: `/support/customers/${id}`, headers });

async function signIn(email = 'priya.sharma@email.com', password = TEST_CONFIG.HOST_DEMO_PASSWORD) {
  return app.inject({ method: 'POST', url: '/login', payload: { email, password } });
}

beforeAll(async () => {
  app = await buildHostApp(TEST_CONFIG, AUTHORS);
});
afterAll(() => app.close());

describe('GET /support/customers/:id', () => {
  it('needs the API key', async () => {
    expect((await customer('AUTH001', {})).statusCode).toBe(401);
    expect((await customer('AUTH001', { authorization: 'Bearer wrong' })).statusCode).toBe(401);
  });

  it('returns 404 for an unknown customer', async () => {
    expect((await customer('AUTH999')).statusCode).toBe(404);
  });

  it('returns the contract shape: account facts, and each book with only its own facts', async () => {
    const res = await customer('AUTH001');
    expect(res.statusCode).toBe(200);
    const c = HostCustomerSchema.parse(res.json());
    expect(c).toMatchObject({ id: 'AUTH001', name: 'Priya Sharma' });
    expect(c.items.map((i) => i.id)).toEqual(['BK001', 'BK002']);
    const accountIds = new Set(c.facts.map((f) => f.id));
    for (const item of c.items) {
      expect(item.facts.every((f) => !accountIds.has(f.id))).toBe(true);
      expect(item.facts.every((f) => f.id.startsWith(`book.${item.id}.`))).toBe(true);
    }
  });
});

describe('sign-in and hand-over to support', () => {
  it('refuses a wrong password or an unknown email', async () => {
    expect((await signIn('priya.sharma@email.com', 'nope-nope')).statusCode).toBe(401);
    expect((await signIn('nobody@email.com')).statusCode).toBe(401);
  });

  it('mints a short support token only for a signed-in author', async () => {
    expect((await app.inject({ method: 'POST', url: '/support-token' })).statusCode).toBe(401);
    const login = await signIn();
    const cookie = login.headers['set-cookie'] as string;
    const res = await app.inject({ method: 'POST', url: '/support-token', headers: { cookie } });
    const { payload } = await jwtVerify(
      res.json<{ token: string }>().token,
      new TextEncoder().encode(TEST_CONFIG.HOST_SIGNING_SECRET),
      { audience: HOST_TOKEN_AUDIENCE },
    );
    const claims = HostTokenClaimsSchema.parse(payload);
    expect(claims).toMatchObject({ sub: 'AUTH001', email: 'priya.sharma@email.com' });
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(HOST_TOKEN_MAX_SECONDS);
  });
});

describe('demo page', () => {
  it('links to the configured support URL', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.body).toContain('content="http://localhost:5173"');
  });
});
