import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pinnedFetch, refusePrivateLookup, type Resolve } from './pinned-fetch.js';

/** Answers like a rebinding DNS server: whatever list it is given, in order, per call. */
const resolver = (...answers: string[][]): Resolve => {
  let call = 0;
  return async () => (answers[Math.min(call++, answers.length - 1)] ?? []).map(toEntry);
};
const toEntry = (address: string) => ({ address, family: address.includes(':') ? 6 : 4 });

const lookupWith = (resolve: Resolve, all = false) =>
  new Promise<{ err: Error | null; address: unknown }>((done) =>
    refusePrivateLookup(resolve)('api.example.com', { all }, (err, address) =>
      done({ err, address }),
    ),
  );

describe('refusePrivateLookup (the address actually connected to)', () => {
  it('passes a public address through', async () => {
    const { err, address } = await lookupWith(resolver(['93.184.216.34']));
    expect(err).toBeNull();
    expect(address).toBe('93.184.216.34');
  });

  it.each([['127.0.0.1'], ['10.0.0.5'], ['169.254.169.254'], ['::1'], ['::ffff:7f00:1']])(
    'refuses %s at connect time',
    async (ip) => {
      const { err } = await lookupWith(resolver([ip]));
      expect(err?.name).toBe('UnsafeUrlError');
    },
  );

  it('refuses when any of several answers is private (no picking the public one)', async () => {
    const { err } = await lookupWith(resolver(['93.184.216.34', '127.0.0.1']), true);
    expect(err?.name).toBe('UnsafeUrlError');
  });

  it('checks every lookup, so a name that rebinds after the first check is refused', async () => {
    const resolve = resolver(['93.184.216.34'], ['127.0.0.1']);
    expect((await lookupWith(resolve)).err).toBeNull();
    expect((await lookupWith(resolve)).err?.name).toBe('UnsafeUrlError');
  });

  it('refuses a name with no addresses', async () => {
    const { err } = await lookupWith(resolver([]));
    expect(err?.name).toBe('UnsafeUrlError');
  });
});

describe('pinnedFetch', () => {
  let server: Server;
  let port = 0;
  beforeAll(async () => {
    server = createServer((_req, res) => res.end('{"ok":true}'));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('never connects to a name that resolves to an internal address', async () => {
    const fetchSafely = pinnedFetch({ allowPrivateHosts: false, resolve: resolver(['127.0.0.1']) });
    await expect(fetchSafely(`http://internal.example.test:${port}/`)).rejects.toThrow();
  });

  it('uses the plain fetch when private hosts are allowed (local development)', async () => {
    const fetchLocally = pinnedFetch({ allowPrivateHosts: true });
    const res = await fetchLocally(`http://127.0.0.1:${port}/`);
    expect(await res.json()).toEqual({ ok: true });
  });
});
