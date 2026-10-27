import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { Problem } from '@bookleaf/shared';
import { AppError, CheckFailedError } from '../errors.js';

const problem = (
  status: number,
  code: string,
  title: string,
  extra: Partial<Problem> & { details?: unknown } = {},
) => ({
  type: `https://bookleaf.example/problems/${code.toLowerCase().replace(/_/g, '-')}`,
  title,
  status,
  code,
  ...extra,
});

const FASTIFY_CODES: Record<string, [number, string, string]> = {
  FST_ERR_CTP_INVALID_MEDIA_TYPE: [
    415,
    'UNSUPPORTED_MEDIA_TYPE',
    'Send the request body as application/json',
  ],
  FST_ERR_CTP_EMPTY_JSON_BODY: [400, 'BAD_REQUEST', 'The request body is empty'],
  FST_ERR_CTP_BODY_TOO_LARGE: [413, 'PAYLOAD_TOO_LARGE', 'The request body is too large'],
  FST_ERR_CTP_INVALID_JSON_BODY: [400, 'BAD_REQUEST', 'The request body is not valid JSON'],
};

/** One place that turns every error into an RFC 7807 problem. Internals are logged, never returned. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      const errors = err.validation.map((v) => ({
        path: v.instancePath.replace(/^\//, '').replace(/\//g, '.') || '(root)',
        message: v.message ?? 'Invalid value',
      }));
      return reply
        .status(422)
        .type('application/problem+json')
        .send(problem(422, 'VALIDATION_FAILED', 'Some fields are invalid', { errors }));
    }
    if (err instanceof CheckFailedError) {
      return reply
        .status(422)
        .type('application/problem+json')
        .send(problem(422, err.code, err.message, { details: err.details }));
    }
    if (err instanceof AppError) {
      const extra = err.fieldErrors ? { errors: err.fieldErrors } : {};
      return reply
        .status(err.status)
        .type('application/problem+json')
        .send(problem(err.status, err.code, err.message, extra));
    }
    const known = err.code ? FASTIFY_CODES[err.code] : undefined;
    if (known)
      return reply
        .status(known[0])
        .type('application/problem+json')
        .send(problem(known[0], known[1], known[2]));
    if (err.statusCode === 429)
      return reply
        .status(429)
        .type('application/problem+json')
        .send(
          problem(429, 'RATE_LIMITED', 'Too many requests. Please wait a minute and try again.'),
        );
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply
        .status(err.statusCode)
        .type('application/problem+json')
        .send(problem(err.statusCode, 'BAD_REQUEST', 'The request could not be processed'));
    }
    req.log.error({ err }, 'unhandled error');
    return reply
      .status(500)
      .type('application/problem+json')
      .send(problem(500, 'INTERNAL', 'Something went wrong on our side. Please try again.'));
  });
  app.setNotFoundHandler((req, reply) => {
    reply
      .status(404)
      .type('application/problem+json')
      .send(problem(404, 'NOT_FOUND', `No route ${req.method} ${req.url.split('?')[0]}`));
  });
}
