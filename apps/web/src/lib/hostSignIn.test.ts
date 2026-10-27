import { afterEach, describe, expect, it, vi } from 'vitest';
import { takeHostToken } from './hostSignIn';

afterEach(() => vi.unstubAllGlobals());

describe('takeHostToken', () => {
  it('reads the token from the fragment and removes it from the address bar', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', { history: { replaceState } });
    const token = takeHostToken({ hash: '#t=abc.def.ghi', pathname: '/auth/host', search: '' });
    expect(token).toBe('abc.def.ghi');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/host');
  });

  it('returns an empty token when there is none', () => {
    vi.stubGlobal('window', { history: { replaceState: vi.fn() } });
    expect(takeHostToken({ hash: '', pathname: '/auth/host', search: '' })).toBe('');
  });
});
