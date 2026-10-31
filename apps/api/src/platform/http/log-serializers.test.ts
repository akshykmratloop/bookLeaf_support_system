import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { logSerializers, pathOnly } from './log-serializers.js';

describe('request log serializer', () => {
  it('drops the query string from the logged URL', () => {
    expect(pathOnly('/api/v1/tickets?q=priya%40email.com&limit=50')).toBe('/api/v1/tickets');
    expect(pathOnly('/health')).toBe('/health');
    expect(pathOnly('')).toBe('');
  });

  it('logs method and path, never the query', async () => {
    const app = Fastify();
    let logged: unknown = null;
    app.get('/search', async (req) => {
      logged = logSerializers.req(req);
      return { ok: true };
    });
    await app.inject({ method: 'GET', url: '/search?ticket=secret-jwt' });
    await app.close();
    expect(logged).toMatchObject({ method: 'GET', url: '/search' });
    expect(JSON.stringify(logged)).not.toContain('secret-jwt');
  });
});
