import type { Problem } from '@bookleaf/shared';

/** A failed API call, carrying the RFC 7807 problem the server returned. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: Problem & { details?: unknown },
  ) {
    super(problem.title);
    this.name = 'ApiError';
  }

  fieldError(path: string): string | undefined {
    return this.problem.errors?.find((e) => e.path === path)?.message;
  }
}

const BASE = '/api/v1';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

function fallbackProblem(status: number): Problem {
  return {
    type: 'about:blank',
    title: status >= 500 ? 'The server had a problem. Please try again.' : 'Request failed',
    status,
    code: 'HTTP_ERROR',
  };
}

const NETWORK_PROBLEM: Problem = {
  type: 'about:blank',
  title: 'Cannot reach the server. Check your connection.',
  status: 0,
  code: 'NETWORK',
};

function headersFor(opts: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
  return headers;
}

/** Sends the request; a network failure becomes an ApiError with status 0. */
async function send(path: string, opts: RequestOptions): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers: headersFor(opts),
      credentials: 'same-origin',
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, NETWORK_PROBLEM);
  }
}

/** JSON-only client. Cookies carry the session; the server never sees a token in JS. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(path, opts);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok)
    throw new ApiError(res.status, (data as Problem | undefined) ?? fallbackProblem(res.status));
  return data as T;
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.problem.title;
  return 'Something went wrong. Please try again.';
}
