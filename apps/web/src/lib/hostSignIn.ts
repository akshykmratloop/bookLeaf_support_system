import type { AuthUser } from '@bookleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

/** Reads the hand-over token from the URL fragment (`#t=…`) and removes it from the address bar. */
export function takeHostToken(location: Pick<Location, 'hash' | 'pathname' | 'search'>): string {
  const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('t') ?? '';
  window.history.replaceState(null, '', `${location.pathname}${location.search}`);
  return token;
}

/** Exchanges the host's hand-over token for a support session. */
export const signInWithHostToken = (token: string) =>
  api<{ user: AuthUser }>('/auth/host', { method: 'POST', body: { token } }).then((r) => r.user);

export const useSignInOptions = () =>
  useQuery({
    queryKey: ['auth-options'],
    queryFn: () => api<{ hostSignInUrl: string | null }>('/auth/options'),
    staleTime: Infinity,
  });
