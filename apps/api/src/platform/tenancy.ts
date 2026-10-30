import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';

/**
 * Which rows the database lets the current code see (S.8, Postgres row-level security).
 * - `workspace`: requests with a session, and anything done for one workspace. Every query runs
 *   on the restricted app role with `app.workspace_id` set, so Postgres itself hides other
 *   workspaces' rows, even when a query forgets its `workspace_id` filter.
 * - `platform`: work that is not for one workspace yet or spans them all (sign-in lookups, signup,
 *   the AI worker, the webhook sender). It runs on the owner connection, which RLS does not limit.
 * Outside both (no scope), the app role sees no tenant rows at all: default deny.
 */
export type DbScope = { kind: 'workspace'; workspaceId: string } | { kind: 'platform' };

const storage = new AsyncLocalStorage<DbScope>();
const WorkspaceIdSchema = z.uuid();

/** The scope the current async call chain runs in, or undefined (no tenant rows visible). */
export const currentScope = (): DbScope | undefined => storage.getStore();

/**
 * Awaits inside the scope. Prisma queries are lazy: `db.x.findMany()` only runs when awaited, so
 * returning it unawaited from the scope would run it outside, with no scope.
 */
const runIn = <T>(scope: DbScope, fn: () => T | PromiseLike<T>): Promise<T> =>
  storage.run(scope, async () => await fn());

/** Runs `fn` (and everything it awaits or starts) as one workspace. */
export function withWorkspace<T>(workspaceId: string, fn: () => T | PromiseLike<T>): Promise<T> {
  return runIn({ kind: 'workspace', workspaceId: WorkspaceIdSchema.parse(workspaceId) }, fn);
}

/**
 * Synchronous form for callback-style code (a Fastify hook's `done`): `fn` and everything it
 * starts run as the workspace. Its result is returned as is, never awaited.
 */
export function runAsWorkspace<T>(workspaceId: string, fn: () => T): T {
  return storage.run({ kind: 'workspace', workspaceId: WorkspaceIdSchema.parse(workspaceId) }, fn);
}

/** Synchronous form of asPlatform for callback-style code (the platform console's request hook). */
export function runAsPlatform<T>(fn: () => T): T {
  return storage.run({ kind: 'platform' }, fn);
}

/** Runs `fn` on the platform (owner) connection. Only for work that is not one workspace's. */
export function asPlatform<T>(fn: () => T | PromiseLike<T>): Promise<T> {
  return runIn({ kind: 'platform' }, fn);
}

/**
 * Ties a callback to the scope it is created in. For callbacks that run later from an event
 * emitter (a socket message, a provider event), which would otherwise run with no scope.
 */
export function bindScope<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  return AsyncLocalStorage.bind(fn);
}
