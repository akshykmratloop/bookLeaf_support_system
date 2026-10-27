import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supportPlugin } from '../src/plugin.js';
import { createHarness, ORIGIN, type Harness } from './helpers/app.js';

let h: Harness;
/** Someone else's product, with the support module mounted under /support. */
let host: FastifyInstance;

beforeAll(async () => {
  h = await createHarness();
  host = Fastify();
  host.get('/', async () => ({ page: 'host home' }));
  await host.register(supportPlugin, { prefix: '/support', container: h.container });
  await host.ready();
});
afterAll(async () => {
  await host.close();
  await h.close();
});

describe('supportPlugin mounted in a host app', () => {
  it('serves health and the API under the chosen prefix', async () => {
    expect((await host.inject({ method: 'GET', url: '/support/health' })).statusCode).toBe(200);
    const me = await host.inject({ method: 'GET', url: '/support/api/v1/auth/me' });
    expect(me.statusCode).toBe(401);
    expect(me.headers['content-type']).toContain('application/problem+json');
  });

  it("keeps its routes, headers and auth inside the prefix: the host's own routes are untouched", async () => {
    const home = await host.inject({ method: 'GET', url: '/' });
    expect(home.json()).toEqual({ page: 'host home' });
    expect(home.headers['content-security-policy']).toBeUndefined();
    expect((await host.inject({ method: 'GET', url: '/api/v1/auth/me' })).statusCode).toBe(404);
  });

  it('still applies its own security inside the prefix (CSRF on writes)', async () => {
    const res = await host.inject({
      method: 'POST',
      url: '/support/api/v1/auth/logout',
      headers: { origin: 'https://evil.example' },
    });
    expect(res.statusCode).toBe(403);
    const ok = await host.inject({
      method: 'POST',
      url: '/support/api/v1/auth/logout',
      headers: { origin: ORIGIN },
    });
    expect(ok.statusCode).toBe(204);
  });
});
