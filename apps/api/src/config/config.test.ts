import { describe, expect, it } from 'vitest';
import { loadEnv } from './index.js';

const REQUIRED = {
  APP_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  JWT_SECRET: 'x'.repeat(32),
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

  it('names every bad setting in one error', () => {
    expect(() => loadEnv({ ...REQUIRED, JWT_SECRET: 'short', PORT: '0' })).toThrow(
      /JWT_SECRET.*PORT|PORT.*JWT_SECRET/,
    );
  });

  it('refuses to start without the required settings', () => {
    expect(() => loadEnv({})).toThrow(/APP_ORIGIN/);
  });
});
