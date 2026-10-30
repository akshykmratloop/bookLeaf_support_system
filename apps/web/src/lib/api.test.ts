import { describe, expect, it } from 'vitest';
import { ApiError, isRetryable } from './api';

const problem = (status: number, errors?: { path: string; message: string }[]) =>
  new ApiError(status, {
    type: 'about:blank',
    title: 'Some fields are invalid',
    status,
    code: 'VALIDATION_FAILED',
    ...(errors ? { errors } : {}),
  });

describe('ApiError.fieldError', () => {
  it('returns the message for an exact path', () => {
    expect(
      problem(422, [{ path: 'brandColor', message: 'Bad colour' }]).fieldError('brandColor'),
    ).toBe('Bad colour');
  });

  it('maps an error on a list entry to its field, naming the entry', () => {
    const err = problem(422, [{ path: 'allowedOrigins.1', message: 'Use a page origin' }]);
    expect(err.fieldError('allowedOrigins')).toBe('Entry 2: Use a page origin');
  });

  it('does not match a different field that only shares a prefix', () => {
    const err = problem(422, [{ path: 'allowedOriginsExtra', message: 'x' }]);
    expect(err.fieldError('allowedOrigins')).toBeUndefined();
  });
});

describe('isRetryable', () => {
  it('offers a retry for network failures, rate limits and server errors', () => {
    for (const status of [0, 408, 429, 500, 503]) expect(isRetryable(problem(status))).toBe(true);
  });

  it('offers no retry when trying again cannot help (forbidden, not found, signed out, invalid)', () => {
    for (const status of [401, 403, 404, 422]) expect(isRetryable(problem(status))).toBe(false);
  });

  it('offers a retry for an unknown error', () => {
    expect(isRetryable(new Error('boom'))).toBe(true);
  });
});
