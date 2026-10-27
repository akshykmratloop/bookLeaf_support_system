import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  AiAuthError,
  AiInvalidOutputError,
  AiRateLimitedError,
  AiUnavailableError,
} from '../errors.js';
import { anthropicProvider } from './provider.js';

/** A local stand-in for the provider's HTTP API: each test picks how it answers. */
let answer: (res: ServerResponse) => void = () => undefined;
let server: Server;

const message = (text: string, stopReason = 'end_turn') => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-5-5',
  content: [{ type: 'text', text }],
  stop_reason: stopReason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
});

const json =
  (status: number, body: unknown, headers: Record<string, string> = {}) =>
  (res: ServerResponse) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  };

const apiError = (type: string) => ({ type: 'error', error: { type, message: 'vendor detail' } });

beforeAll(async () => {
  server = createServer((req, res) => {
    req.resume();
    req.on('end', () => answer(res));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  vi.stubEnv('ANTHROPIC_BASE_URL', `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});

const call = (timeoutMs = 2_000) =>
  anthropicProvider({ apiKey: 'test-key', timeoutMs }).generateStructured({
    task: 'TRIAGE',
    model: 'claude-haiku-5-5',
    stableSystem: 'sys',
    user: 'hello',
    schema: z.object({ category: z.string() }),
    maxTokens: 50,
  });

describe('provider failures become capability errors (the worker then retries or falls back)', () => {
  it('a valid answer is parsed', async () => {
    answer = json(200, message('{"category":"ROYALTY_PAYMENTS"}'));
    await expect(call()).resolves.toMatchObject({ data: { category: 'ROYALTY_PAYMENTS' } });
  });

  it('429 → rate limited, retryable, with the retry-after delay', async () => {
    answer = json(429, apiError('rate_limit_error'), { 'retry-after': '7' });
    const err = await call().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiRateLimitedError);
    expect((err as AiRateLimitedError).retryAfterMs).toBe(7000);
  });

  it('401 → auth error, not retryable, and the vendor message does not leak', async () => {
    answer = json(401, apiError('authentication_error'));
    const err = await call().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiAuthError);
    expect((err as Error).message).not.toContain('vendor detail');
  });

  it('500 → unavailable, retryable', async () => {
    answer = json(500, apiError('api_error'));
    await expect(call()).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it('no answer within the timeout → unavailable', async () => {
    answer = () => undefined; // never responds
    await expect(call(200)).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it('text that is not JSON → invalid output', async () => {
    answer = json(200, message('Sure! The category is royalties.'));
    await expect(call()).rejects.toBeInstanceOf(AiInvalidOutputError);
  });

  it('JSON that does not match the schema → invalid output', async () => {
    answer = json(200, message('{"priority":"HIGH"}'));
    await expect(call()).rejects.toBeInstanceOf(AiInvalidOutputError);
  });

  it('a reply cut off at the token limit → invalid output', async () => {
    answer = json(200, message('{"category":"ROY', 'max_tokens'));
    await expect(call()).rejects.toBeInstanceOf(AiInvalidOutputError);
  });
});
