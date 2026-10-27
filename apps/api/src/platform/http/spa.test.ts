import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerSpa } from './spa.js';

let dir: string;
let app: FastifyInstance;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'spa-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>t</title>');
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), 'console.log(1)');
  writeFileSync(join(dir, 'favicon.svg'), '<svg/>');
  writeFileSync(join(dir, 'embed.js'), '(() => {})();');
  app = Fastify();
  await registerSpa(app, dir);
  await app.ready();
});
afterAll(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('web app caching', () => {
  it('never caches index.html, so a new deploy reaches users on the next load', async () => {
    for (const url of ['/', '/assistant', '/index.html']) {
      const res = await app.inject({ url });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('caches content-hashed assets for a year (their name changes on every build)', async () => {
    const res = await app.inject({ url: '/assets/index-abc123.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('returns 404 for a missing file instead of the page (no blank screen after a deploy)', async () => {
    for (const url of ['/assets/index-old999.js', '/missing.css', '/logo.png']) {
      const res = await app.inject({ url });
      expect(res.statusCode).toBe(404);
    }
  });

  it('caches other static files briefly', async () => {
    const res = await app.inject({ url: '/favicon.svg' });
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
  });

  it('revalidates the widget script on every load, so host pages pick up a new widget at once', async () => {
    const res = await app.inject({ url: '/embed.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers.etag).toBeTruthy();
  });
});
