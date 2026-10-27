import type { FastifyError, FastifyInstance, FastifyReply } from 'fastify';
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

type ProblemBody = ReturnType<typeof problem>;

function validationProblem(err: FastifyError): ProblemBody | null {
  if (!hasZodFastifySchemaValidationErrors(err)) return null;
  const errors = err.validation.map((v) => ({
    path: v.instancePath.replace(/^\//, '').replace(/\//g, '.') || '(root)',
    message: v.message ?? 'Invalid value',
  }));
  return problem(422, 'VALIDATION_FAILED', 'Some fields are invalid', { errors });
}

/** Our own typed errors carry their status, code and message. */
function appProblem(err: unknown): ProblemBody | null {
  if (err instanceof CheckFailedError)
    return problem(422, err.code, err.message, { details: err.details });
  if (!(err instanceof AppError)) return null;
  const extra = err.fieldErrors ? { errors: err.fieldErrors } : {};
  return problem(err.status, err.code, err.message, extra);
}

/** Errors raised by Fastify itself or its plugins (body parsing, rate limit, other 4xx). */
function frameworkProblem(err: FastifyError): ProblemBody | null {
  const known = err.code ? FASTIFY_CODES[err.code] : undefined;
  if (known) return problem(known[0], known[1], known[2]);
  if (err.statusCode === 429)
    return problem(429, 'RATE_LIMITED', 'Too many requests. Please wait a minute and try again.');
  if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500)
    return problem(err.statusCode, 'BAD_REQUEST', 'The request could not be processed');
  return null;
}

const INTERNAL = problem(500, 'INTERNAL', 'Something went wrong on our side. Please try again.');

const sendProblem = (reply: FastifyReply, body: ProblemBody) =>
  reply.status(body.status).type('application/problem+json').send(body);

/** One place that turns every error into an RFC 7807 problem. Internals are logged, never returned. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const body = validationProblem(err) ?? appProblem(err) ?? frameworkProblem(err);
    if (body) return sendProblem(reply, body);
    req.log.error({ err }, 'unhandled error');
    return sendProblem(reply, INTERNAL);
  });
  app.setNotFoundHandler((req, reply) => {
    sendProblem(
      reply,
      problem(404, 'NOT_FOUND', `No route ${req.method} ${req.url.split('?')[0]}`),
    );
  });
}
