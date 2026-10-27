import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

/** The Fastify instance a route plugin receives, typed for Zod schemas. */
export type RouteApp = Parameters<FastifyPluginAsyncZod>[0];
