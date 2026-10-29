import { describe, expect, it } from 'vitest';
import { loadEnv } from './index.js';

const REQUIRED = {
  APP_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
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
});
