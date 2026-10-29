import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildHostApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { AUTHORS, TEST_CONFIG } from './fixtures.js';

let app: FastifyInstance | null = null;
afterEach(async () => {
  await app?.close();
  app = null;
});

const signIn = (a: FastifyInstance) =>
  a.inject({
    method: 'POST',
    url: '/login',
    payload: { email: 'priya.sharma@email.com', password: TEST_CONFIG.HOST_DEMO_PASSWORD },
  });

describe('running behind a proxy (deployment)', () => {
  it('answers a health check without signing in', async () => {
    app = await buildHostApp(TEST_CONFIG, AUTHORS);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('marks the session cookie Secure when HOST_SECURE_COOKIES is on', async () => {
    app = await buildHostApp({ ...TEST_CONFIG, HOST_SECURE_COOKIES: true }, AUTHORS);
    const cookie = String((await signIn(app)).headers['set-cookie']);
    expect(cookie).toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('keeps plain HTTP sign-in working locally (Secure off by default)', async () => {
    expect(loadConfig({ ...process.env, ...stringEnv() }).HOST_SECURE_COOKIES).toBe(false);
    app = await buildHostApp(TEST_CONFIG, AUTHORS);
    expect(String((await signIn(app)).headers['set-cookie'])).not.toMatch(/;\s*Secure/i);
  });
});

function stringEnv(): Record<string, string> {
  return {
    HOST_API_KEY: TEST_CONFIG.HOST_API_KEY,
    HOST_SIGNING_SECRET: TEST_CONFIG.HOST_SIGNING_SECRET,
  };
}
