import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { onSessionExpired, resetSessionExpiry, signalSessionExpired } from './sessionExpiry';

const respond = (status: number, body: string, type = 'application/json') =>
  vi.fn(
    async () =>
      new Response(status === 204 ? null : body, { status, headers: { 'content-type': type } }),
  );

async function failureOf(path: string): Promise<ApiError> {
  try {
    await api(path);
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error('expected the call to fail');
}

beforeEach(() => resetSessionExpiry());
afterEach(() => vi.unstubAllGlobals());

describe('api: bodies that are not JSON', () => {
  it("turns a proxy's HTML error page into a plain server problem", async () => {
    vi.stubGlobal('fetch', respond(502, '<html><body>Bad gateway</body></html>', 'text/html'));
    const err = await failureOf('/tickets');
    expect(err.status).toBe(502);
    expect(err.problem).toMatchObject({ code: 'HTTP_ERROR', status: 502 });
    expect(err.problem.title).toMatch(/server had a problem/);
  });

  it('a JSON error without a problem shape also gets the fallback', async () => {
    vi.stubGlobal('fetch', respond(500, '"oops"'));
    expect((await failureOf('/tickets')).problem.code).toBe('HTTP_ERROR');
  });

  it('keeps the problem the API returned', async () => {
    const problem = { type: 'about:blank', title: 'Not found', status: 404, code: 'NOT_FOUND' };
    vi.stubGlobal('fetch', respond(404, JSON.stringify(problem)));
    expect((await failureOf('/tickets/x')).problem).toEqual(problem);
  });

  it('a 200 that is not JSON is a failure, not a crash', async () => {
    vi.stubGlobal('fetch', respond(200, '<!doctype html><title>app</title>', 'text/html'));
    const err = await failureOf('/tickets');
    expect(err.status).toBe(502);
  });

  it('reads JSON and 204 as before', async () => {
    vi.stubGlobal('fetch', respond(200, '{"items":[]}'));
    await expect(api('/tickets')).resolves.toEqual({ items: [] });
    vi.stubGlobal('fetch', respond(204, ''));
    await expect(api('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
});

describe('api: a 401 means the session ended', () => {
  const unauthorized = JSON.stringify({
    type: 'about:blank',
    title: 'Your session has expired. Please sign in again.',
    status: 401,
    code: 'UNAUTHORIZED',
  });

  it('tells the app once, however many calls fail together', async () => {
    const expired = vi.fn();
    onSessionExpired(expired);
    vi.stubGlobal('fetch', respond(401, unauthorized));
    await Promise.all([failureOf('/tickets'), failureOf('/books'), failureOf('/chat/sessions')]);
    expect(expired).toHaveBeenCalledOnce();
  });

  it.each(['/auth/me', '/auth/login', '/auth/host', '/platform/auth/me'])(
    'stays quiet for %s (a 401 there is an answer, not an expiry)',
    async (path) => {
      const expired = vi.fn();
      onSessionExpired(expired);
      vi.stubGlobal('fetch', respond(401, unauthorized));
      await failureOf(path);
      expect(expired).not.toHaveBeenCalled();
    },
  );

  it('signals again after a quiet period, and stops after unsubscribe', () => {
    const expired = vi.fn();
    const stop = onSessionExpired(expired);
    signalSessionExpired(1_000);
    signalSessionExpired(2_000);
    signalSessionExpired(7_000);
    expect(expired).toHaveBeenCalledTimes(2);
    stop();
    signalSessionExpired(20_000);
    expect(expired).toHaveBeenCalledTimes(2);
  });
});
