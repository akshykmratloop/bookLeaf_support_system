import type { FastifyRequest } from 'fastify';

/** What a log line says about a request (a type, so it fits pino's open-ended record). */
export type LoggedRequest = {
  method: string;
  url: string;
  host: string;
  remoteAddress: string;
  remotePort: number | undefined;
};

/** The path alone: query strings can carry search words, tokens or e-mail addresses. */
export const pathOnly = (url: string): string => url.split('?')[0] ?? '';

/**
 * Fastify's request log fields, but the URL is logged without its query string so nothing a
 * visitor typed into a link ends up in the logs.
 */
export const logSerializers = {
  req: (req: FastifyRequest): LoggedRequest => ({
    method: req.method,
    url: pathOnly(req.url),
    host: req.host,
    remoteAddress: req.ip,
    remotePort: req.socket?.remotePort,
  }),
};
