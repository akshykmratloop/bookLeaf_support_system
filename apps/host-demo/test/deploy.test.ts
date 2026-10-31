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
    payload: { email: 'priya@bookleaf.com', password: TEST_CONFIG.HOST_DEMO_PASSWORD },
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

describe('configuration', () => {
  it('has no built-in demo password: it must be set, at least 12 characters', () => {
    const { HOST_DEMO_PASSWORD: _unset, ...rest } = stringEnv();
    expect(() => loadConfig(rest)).toThrow(/HOST_DEMO_PASSWORD/);
    expect(() => loadConfig({ ...rest, HOST_DEMO_PASSWORD: 'short-pass' })).toThrow(
      /at least 12 characters/,
    );
    expect(loadConfig(stringEnv()).HOST_DEMO_PASSWORD).toBe(TEST_CONFIG.HOST_DEMO_PASSWORD);
  });

  it('trusts X-Forwarded-For only when HOST_TRUST_PROXY is on', () => {
    expect(loadConfig(stringEnv()).HOST_TRUST_PROXY).toBe(false);
    expect(loadConfig({ ...stringEnv(), HOST_TRUST_PROXY: 'true' }).HOST_TRUST_PROXY).toBe(true);
  });
});

function stringEnv(): Record<string, string> {
  return {
    HOST_API_KEY: TEST_CONFIG.HOST_API_KEY,
    HOST_SIGNING_SECRET: TEST_CONFIG.HOST_SIGNING_SECRET,
    HOST_DEMO_PASSWORD: TEST_CONFIG.HOST_DEMO_PASSWORD,
  };
}
