import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const REQUIRED = {
  HOST_API_KEY: 'k'.repeat(24),
  HOST_SIGNING_SECRET: 's'.repeat(32),
  HOST_DEMO_PASSWORD: 'TestBookLeaf@123',
};

describe('SUPPORT_URL', () => {
  it('takes an http or https address (the widget script is loaded from it)', () => {
    expect(
      loadConfig({ ...REQUIRED, SUPPORT_URL: 'https://support.example.com' }).SUPPORT_URL,
    ).toBe('https://support.example.com');
    expect(loadConfig(REQUIRED).SUPPORT_URL).toBe('http://localhost:3100');
  });

  it('refuses any other scheme', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/javascript,1',
      'ftp://support.example.com',
    ])
      expect(() => loadConfig({ ...REQUIRED, SUPPORT_URL: bad }), bad).toThrow(/SUPPORT_URL/);
  });
});
