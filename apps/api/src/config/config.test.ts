import { describe, expect, it } from 'vitest';
import { loadEnv } from './index.js';

const REQUIRED = {
  APP_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://app:p@localhost:5433/db',
  DATABASE_ADMIN_URL: 'postgresql://owner:p@localhost:5433/db',
  JWT_SECRET: 'x'.repeat(32),
  HOST_API_URL: 'http://localhost:3200',
  HOST_API_KEY: 'k'.repeat(24),
  HOST_SIGNING_SECRET: 's'.repeat(32),
};

describe('loadEnv', () => {
  it('fills every area with its defaults', () => {
    const env = loadEnv(REQUIRED);
    expect(env).toMatchObject({
      PORT: 3000,
      SESSION_TTL_HOURS: 8,
      WORKER_ENABLED: true,
      CHAT_MAX_TURNS_PER_SESSION: 30,
      VOICE_CALLS_PER_HOUR: 5,
    });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('keeps host hand-over sessions short: 2 hours by default, 1 to 24 allowed', () => {
    expect(loadEnv(REQUIRED).HOST_SESSION_TTL_HOURS).toBe(2);
    expect(loadEnv({ ...REQUIRED, HOST_SESSION_TTL_HOURS: '24' }).HOST_SESSION_TTL_HOURS).toBe(24);
    expect(() => loadEnv({ ...REQUIRED, HOST_SESSION_TTL_HOURS: '0' })).toThrow(
      /HOST_SESSION_TTL_HOURS/,
    );
    expect(() => loadEnv({ ...REQUIRED, HOST_SESSION_TTL_HOURS: '25' })).toThrow(
      /HOST_SESSION_TTL_HOURS/,
    );
  });

  it('treats an empty key as not set', () => {
    expect(loadEnv({ ...REQUIRED, OPENAI_API_KEY: '' }).OPENAI_API_KEY).toBeUndefined();
  });

  it('reads the public call-socket origin (wss only); empty means the page host', () => {
    expect(loadEnv({ ...REQUIRED, PUBLIC_API_WS_ORIGIN: '' }).PUBLIC_API_WS_ORIGIN).toBeUndefined();
    expect(
      loadEnv({ ...REQUIRED, PUBLIC_API_WS_ORIGIN: 'wss://api.example.com/' }).PUBLIC_API_WS_ORIGIN,
    ).toBe('wss://api.example.com');
    expect(() => loadEnv({ ...REQUIRED, PUBLIC_API_WS_ORIGIN: 'https://api.example.com' })).toThrow(
      /PUBLIC_API_WS_ORIGIN/,
    );
  });

  it('names every bad setting in one error', () => {
    expect(() => loadEnv({ ...REQUIRED, JWT_SECRET: 'short', PORT: '0' })).toThrow(
      /JWT_SECRET.*PORT|PORT.*JWT_SECRET/,
    );
  });

  it('refuses to start without the required settings', () => {
    expect(() => loadEnv({})).toThrow(/APP_ORIGIN/);
  });

  it('needs the host connection: customer data only comes from the host', () => {
    const { HOST_API_URL: _url, ...withoutHost } = REQUIRED;
    expect(() => loadEnv(withoutHost)).toThrow(/HOST_API_URL/);
    expect(loadEnv(REQUIRED)).toMatchObject({ HOST_TIMEOUT_MS: 3000, HOST_CACHE_SECONDS: 60 });
  });

  it('refuses a host signing secret equal to the session secret', () => {
    const same = { ...REQUIRED, HOST_SIGNING_SECRET: REQUIRED.JWT_SECRET };
    expect(() => loadEnv(same)).toThrow(/HOST_SIGNING_SECRET/);
  });

  it('refuses to start in production without REDIS_URL (shared state for every copy)', () => {
    const production = {
      ...REQUIRED,
      NODE_ENV: 'production',
      SECRETS_MASTER_KEY: Buffer.alloc(32, 1).toString('base64'),
    };
    expect(() => loadEnv(production)).toThrow(/REDIS_URL: is required in production/);
    expect(loadEnv({ ...production, REDIS_URL: 'redis://redis:6379' })).toMatchObject({
      REDIS_URL: 'redis://redis:6379',
      REDIS_KEY_PREFIX: 'bookleaf',
    });
  });

  it('reads REDIS_URL only as a redis:// address; empty means not set outside production', () => {
    expect(loadEnv({ ...REQUIRED, REDIS_URL: '' }).REDIS_URL).toBeUndefined();
    expect(() => loadEnv({ ...REQUIRED, REDIS_URL: 'http://localhost:6379' })).toThrow(/REDIS_URL/);
    expect(() => loadEnv({ ...REQUIRED, REDIS_KEY_PREFIX: 'bad prefix' })).toThrow(
      /REDIS_KEY_PREFIX/,
    );
  });

  it('needs both database connections: the app role and the owner (S.8)', () => {
    const { DATABASE_ADMIN_URL: _admin, ...withoutAdmin } = REQUIRED;
    expect(() => loadEnv(withoutAdmin)).toThrow(/DATABASE_ADMIN_URL/);
  });

  it('refuses one user for both connections in production (RLS would be bypassed)', () => {
    const production = {
      ...REQUIRED,
      NODE_ENV: 'production',
      SECRETS_MASTER_KEY: Buffer.alloc(32, 1).toString('base64'),
      REDIS_URL: 'redis://redis:6379',
    };
    expect(loadEnv(production).DATABASE_ADMIN_URL).toBe(REQUIRED.DATABASE_ADMIN_URL);
    const same = { ...production, DATABASE_URL: 'postgresql://owner:p@db:5432/db' };
    expect(() => loadEnv(same)).toThrow(/DATABASE_URL: must use the restricted app role/);
    expect(loadEnv({ ...same, NODE_ENV: 'development' }).DATABASE_URL).toContain('owner');
  });

  it('refuses the .env.example placeholders ("replace-with-...") as secrets in production', () => {
    const production = {
      ...REQUIRED,
      NODE_ENV: 'production',
      SECRETS_MASTER_KEY: Buffer.alloc(32, 1).toString('base64'),
      REDIS_URL: 'redis://redis:6379',
    };
    expect(loadEnv(production).NODE_ENV).toBe('production');
    const placeholder = 'replace-with-a-long-random-secret-at-least-32-chars';
    expect(() => loadEnv({ ...production, JWT_SECRET: placeholder })).toThrow(
      /JWT_SECRET: is still the \.env\.example placeholder/,
    );
    const masterKey = 'replace-with-openssl-rand-base64-32-output-here';
    expect(() => loadEnv({ ...production, SECRETS_MASTER_KEY: masterKey })).toThrow(
      /SECRETS_MASTER_KEY: is still the \.env\.example placeholder/,
    );
  });
});
