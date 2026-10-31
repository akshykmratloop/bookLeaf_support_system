import type { Problem } from '@bookleaf/shared';
import { signalSessionExpired } from './sessionExpiry';

/** A failed API call, carrying the RFC 7807 problem the server returned. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: Problem & { details?: unknown },
  ) {
    super(problem.title);
    this.name = 'ApiError';
  }

  /** The message for a field. An error on a list entry (`origins.1`) names the entry. */
  fieldError(path: string): string | undefined {
    const hit = this.problem.errors?.find((e) => e.path === path || e.path.startsWith(`${path}.`));
    if (!hit) return undefined;
    const index = /^\.(\d+)/.exec(hit.path.slice(path.length))?.[1];
    return index === undefined ? hit.message : `Entry ${Number(index) + 1}: ${hit.message}`;
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

/** Marks a body that is not JSON, e.g. a proxy's HTML 502 page. */
const NOT_JSON = Symbol('not-json');

/** The body as JSON: undefined when empty, NOT_JSON when it cannot be read as JSON. */
function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return NOT_JSON;
  }
}

/** A problem body has at least a title; anything else is replaced by a generic one. */
const isProblem = (data: unknown): data is Problem =>
  typeof data === 'object' && data !== null && typeof (data as Problem).title === 'string';

/**
 * Calls whose 401 is an answer, not an ended session: the "who am I" probe and signing in. Every
 * other 401 means the session ended, and the app is told once (sessionExpiry).
 */
const SIGN_IN_PATHS = /^\/(platform\/)?auth\/(me|login|host)(\?|$)/;

function failure(path: string, status: number, data: unknown): ApiError {
  if (status === 401 && !SIGN_IN_PATHS.test(path)) signalSessionExpired();
  return new ApiError(status, isProblem(data) ? data : fallbackProblem(status));
}

/** JSON-only client. Cookies carry the session; the server never sees a token in JS. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(path, opts);
  if (res.status === 204) return undefined as T;
  const data = parseBody(await res.text());
  if (!res.ok) throw failure(path, res.status, data);
  // A success that is not JSON came from something in between (a proxy page), not the API.
  if (data === NOT_JSON) throw new ApiError(502, fallbackProblem(502));
  return data as T;
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.problem.title;
  return 'Something went wrong. Please try again.';
}

/** Statuses where asking again later can succeed: no connection, timeout, rate limit, server error. */
const RETRYABLE_STATUS = (status: number) =>
  status === 0 || status === 408 || status === 429 || status >= 500;

/** False when trying again cannot help (forbidden, not found, signed out, invalid request). */
export function isRetryable(e: unknown): boolean {
  return isApiError(e) ? RETRYABLE_STATUS(e.status) : true;
}
