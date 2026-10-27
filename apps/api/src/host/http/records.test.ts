import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CustomerNotFoundError, HostUnavailableError } from '../errors.js';
import { httpHostRecords, type HttpHostOptions } from './records.js';

const API_KEY = 'unit-test-host-api-key-123456';
const CUSTOMER = {
  id: 'C1',
  name: 'Asha Rao',
  email: 'asha@example.com',
  items: [],
  facts: [],
  details: [],
};

/** A real HTTP server playing the host; each test decides how it answers. */
let host: FastifyInstance;
let baseUrl: string;
let reply: (id: string) => { status: number; body: unknown; delayMs?: number };
let calls: { id: string; auth: string | undefined }[];

beforeAll(async () => {
  host = Fastify();
  host.get<{ Params: { id: string } }>('/support/customers/:id', async (req, res) => {
    calls.push({ id: req.params.id, auth: req.headers.authorization });
    const r = reply(req.params.id);
    if (r.delayMs) await new Promise((done) => setTimeout(done, r.delayMs));
    return res.status(r.status).send(r.body);
  });
  baseUrl = await host.listen({ port: 0, host: '127.0.0.1' });
});
afterAll(() => host.close());
beforeEach(() => {
  calls = [];
  reply = () => ({ status: 200, body: CUSTOMER });
});

let clock = 0;
const records = (overrides: Partial<HttpHostOptions> = {}) =>
  httpHostRecords({
    baseUrl,
    apiKey: API_KEY,
    timeoutMs: 300,
    cacheSeconds: 60,
    now: () => clock,
    ...overrides,
  });

describe('httpHostRecords', () => {
  it('reads a customer with the API key and checks it against the contract', async () => {
    expect(await records().customer('C1')).toEqual(CUSTOMER);
    expect(calls).toEqual([{ id: 'C1', auth: `Bearer ${API_KEY}` }]);
  });

  it('reuses a customer for the cache time, then asks again', async () => {
    const r = records();
    await r.customer('C1');
    await r.customer('C1');
    expect(calls).toHaveLength(1);
    clock += 60_000;
    await r.customer('C1');
    expect(calls).toHaveLength(2);
  });

  it('maps 404 to CustomerNotFoundError', async () => {
    reply = () => ({ status: 404, body: { error: 'Unknown customer' } });
    await expect(records().customer('C9')).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it('maps a host error, a slow host and a broken payload to HostUnavailableError', async () => {
    reply = () => ({ status: 500, body: { error: 'boom' } });
    await expect(records().customer('C1')).rejects.toBeInstanceOf(HostUnavailableError);
    reply = () => ({ status: 200, body: CUSTOMER, delayMs: 1000 });
    await expect(records().customer('C1')).rejects.toBeInstanceOf(HostUnavailableError);
    reply = () => ({ status: 200, body: { ...CUSTOMER, email: 'not-an-email' } });
    await expect(records().customer('C1')).rejects.toBeInstanceOf(HostUnavailableError);
  });

  it('never caches a failure', async () => {
    reply = () => ({ status: 500, body: {} });
    const r = records();
    await expect(r.customer('C1')).rejects.toBeInstanceOf(HostUnavailableError);
    reply = () => ({ status: 200, body: CUSTOMER });
    expect(await r.customer('C1')).toEqual(CUSTOMER);
  });

  it('encodes the customer id in the URL', async () => {
    await records().customer('a/b?c');
    expect(calls[0]?.id).toBe('a/b?c');
  });
});
