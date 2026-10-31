import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signOutForHost } from './useHostSignOut';

const posted: { type: string }[] = [];

beforeEach(() => {
  posted.length = 0;
  const parent = { postMessage: (data: { type: string }) => void posted.push(data) };
  // Framed: the parent is another window.
  vi.stubGlobal('window', { self: {}, top: parent, parent, addEventListener: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe('signing out when the host page asks', () => {
  it('ends the support session, then tells the host page it is done', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const signedOut = vi.fn();
    await signOutForHost(signedOut);
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(signedOut).toHaveBeenCalledOnce();
    expect(posted.map((m) => m.type)).toContain('bookleaf-support:signedout');
  });

  it('still lets the host page carry on when the logout call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    const signedOut = vi.fn();
    await expect(signOutForHost(signedOut)).rejects.toMatchObject({ status: 0 });
    expect(signedOut).toHaveBeenCalledOnce();
    expect(posted.map((m) => m.type)).toContain('bookleaf-support:signedout');
  });
});
