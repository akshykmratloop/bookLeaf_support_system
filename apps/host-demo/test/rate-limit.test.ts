import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildHostApp } from '../src/app.js';
import { LOGINS_PER_MINUTE, SUPPORT_TOKENS_PER_MINUTE } from '../src/routes/account.js';
import { AUTHORS, TEST_CONFIG } from './fixtures.js';

let app: FastifyInstance | null = null;
afterEach(async () => {
  await app?.close();
  app = null;
});

const login = (a: FastifyInstance, email: string, password: string, ip = '203.0.113.7') =>
  a.inject({ method: 'POST', url: '/login', payload: { email, password }, remoteAddress: ip });

describe('sign-in limits', () => {
  it('refuses the 11th sign-in a minute for one address and email (429)', async () => {
    app = await buildHostApp(TEST_CONFIG, AUTHORS);
    const email = 'priya.sharma@email.com';
    for (let i = 0; i < LOGINS_PER_MINUTE; i += 1)
      expect((await login(app, email, 'wrong-password')).statusCode).toBe(401);
    expect((await login(app, email, TEST_CONFIG.HOST_DEMO_PASSWORD)).statusCode).toBe(429);
    // Another email from the same address, and the same email from another address, still work.
    expect((await login(app, 'nobody@email.com', 'x')).statusCode).toBe(401);
    const other = await login(app, email, TEST_CONFIG.HOST_DEMO_PASSWORD, '198.51.100.9');
    expect(other.statusCode).toBe(200);
  });

  it('counts an email the same whatever its letter case', async () => {
    app = await buildHostApp(TEST_CONFIG, AUTHORS);
    for (let i = 0; i < LOGINS_PER_MINUTE; i += 1)
      await login(app, i % 2 ? 'PRIYA.sharma@email.com' : 'priya.sharma@email.com', 'nope');
    expect((await login(app, 'Priya.Sharma@Email.com', 'nope')).statusCode).toBe(429);
  });
});

describe('support token limits', () => {
  it('refuses the 31st support token a minute for one session (429)', async () => {
    app = await buildHostApp(TEST_CONFIG, AUTHORS);
    const a = app;
    const signedIn = await login(a, 'priya.sharma@email.com', TEST_CONFIG.HOST_DEMO_PASSWORD);
    const cookie = signedIn.headers['set-cookie'] as string;
    const token = () => a.inject({ method: 'POST', url: '/support-token', headers: { cookie } });
    for (let i = 0; i < SUPPORT_TOKENS_PER_MINUTE; i += 1)
      expect((await token()).statusCode).toBe(200);
    expect((await token()).statusCode).toBe(429);
  });
});
