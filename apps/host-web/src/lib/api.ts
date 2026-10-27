import { z } from 'zod';
import { DashboardSchema, type Dashboard } from '@bookleaf/host-demo/dashboard';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const messageOf = (body: unknown, fallback: string) =>
  typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
    ? body.error
    : fallback;

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok)
    throw new ApiError(res.status, messageOf(body, 'Something went wrong. Please try again.'));
  return body;
}

const ConfigSchema = z.object({ supportUrl: z.url() });

/** Responses are checked at the boundary, never trusted as they are. */
export const getDashboard = async (): Promise<Dashboard> =>
  DashboardSchema.parse(await call('/api/dashboard'));
export const getConfig = async () => ConfigSchema.parse(await call('/api/config'));
export const signIn = (email: string, password: string) =>
  call('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const signOut = () => call('/logout', { method: 'POST', body: '{}' });

export const isSignedOut = (err: unknown) => err instanceof ApiError && err.status === 401;
