import type { HostSignInResponse } from '@bookleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

/** Reads the hand-over token from the URL fragment (`#t=…`) and removes it from the address bar. */
export function takeHostToken(location: Pick<Location, 'hash' | 'pathname' | 'search'>): string {
  const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('t') ?? '';
  window.history.replaceState(null, '', `${location.pathname}${location.search}`);
  return token;
}

/**
 * Exchanges the host's hand-over token for a support session. A widget page names its own
 * workspace (`/embed/<slug>`): the server refuses a token for any other workspace.
 */
export const signInWithHostToken = (token: string, workspace?: string) =>
  api<HostSignInResponse>('/auth/host', {
    method: 'POST',
    body: workspace ? { token, workspace } : { token },
  });

export const useSignInOptions = () =>
  useQuery({
    queryKey: ['auth-options'],
    queryFn: () => api<{ hostSignInUrl: string | null }>('/auth/options'),
    staleTime: Infinity,
  });
