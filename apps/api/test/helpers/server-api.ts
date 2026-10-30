import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';
import { call, type Harness } from './app.js';

type Method = 'GET' | 'POST' | 'PATCH';

/** Mints a workspace API key with these scopes as the signed-in admin. */
export async function mintKey(h: Harness, cookie: string, scopes: string[]) {
  const res = await call(h, 'POST', '/workspace/api-keys', cookie, { name: 'Server', scopes });
  expect(res.statusCode).toBe(201);
  return res.json<{ plainKey: string; key: { id: string } }>();
}

export interface ServerCall {
  key?: string;
  body?: unknown;
  /** An Idempotency-Key header; `true` sends a fresh UUID. */
  idem?: string | true;
}

/** A server-to-server call: Bearer API key, no cookie, no Origin. */
export function asServer(
  h: Harness,
  method: Method,
  url: string,
  { key, body, idem }: ServerCall = {},
): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = {};
  if (key) headers.authorization = `Bearer ${key}`;
  if (idem) headers['idempotency-key'] = idem === true ? randomUUID() : idem;
  return h.app.inject({
    method,
    url: `/api/v1${url}`,
    headers,
    ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
  });
}

export const SERVER_TICKET = {
  customerId: 'AUTH001',
  subject: 'Royalty statement question',
  body: 'My royalty statement for last quarter looks lower than I expected.',
};
