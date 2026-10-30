import type { Prisma, PrismaClient } from '@prisma/client';
import { createDb, type Db } from './db.js';
import { currentScope } from './tenancy.js';

/** The two connections behind the app's one `Db` (S.8). */
export interface TenantDbUrls {
  /** The restricted app role (no BYPASSRLS): every request runs here. */
  appUrl: string;
  /** The owner role: migrations, signup, sign-in lookups, the background worker. */
  adminUrl: string;
}

type TxClient = Prisma.TransactionClient;
type InteractiveTx = (tx: TxClient) => Promise<unknown>;
type TxOptions = Parameters<PrismaClient['$transaction']>[1];

const setWorkspace = (db: TxClient | PrismaClient, workspaceId: string) =>
  db.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;

/**
 * Prisma's row-level-security pattern: in a workspace scope each query runs in a small
 * transaction that first sets `app.workspace_id` for that transaction only (pooled-safe).
 */
function scopedAppClient(base: PrismaClient): PrismaClient {
  const extended = base.$extends({
    query: {
      async $allOperations({ args, query }) {
        const scope = currentScope();
        if (scope?.kind !== 'workspace') return query(args);
        const [, result] = await base.$transaction([
          setWorkspace(base, scope.workspaceId),
          query(args),
        ]);
        return result;
      },
    },
  });
  // A query-only extension leaves the model API exactly as PrismaClient types it.
  return extended as unknown as PrismaClient;
}

const BATCH_IN_WORKSPACE =
  'Batch $transaction([...]) is not supported in a workspace scope: use $transaction(async (tx) => ...)';

/** Interactive transactions set the workspace once, as their first statement. */
function transactionFor(app: PrismaClient, appBase: PrismaClient, admin: PrismaClient) {
  return (input: InteractiveTx | Prisma.PrismaPromise<unknown>[], options?: TxOptions) => {
    const scope = currentScope();
    if (scope?.kind === 'platform') return admin.$transaction(input as InteractiveTx, options);
    if (Array.isArray(input)) {
      if (scope) throw new Error(BATCH_IN_WORKSPACE);
      return app.$transaction(input, options);
    }
    if (!scope) return appBase.$transaction(input, options);
    return appBase.$transaction(async (tx) => {
      await setWorkspace(tx, scope.workspaceId);
      return input(tx);
    }, options);
  };
}

/**
 * One `Db` for the whole app that picks its connection per call from the current scope
 * (platform/tenancy.ts): platform → owner; workspace → app role with `app.workspace_id`;
 * none → app role with nothing set, so tenant tables return no rows.
 */
export function createTenantDb({ appUrl, adminUrl }: TenantDbUrls): Db {
  const appBase = createDb(appUrl);
  const admin = createDb(adminUrl);
  const app = scopedAppClient(appBase);
  const transaction = transactionFor(app, appBase, admin);
  const both = async (fn: (c: PrismaClient) => Promise<void>) => {
    await Promise.all([fn(appBase), fn(admin)]);
  };
  const own: Record<string | symbol, unknown> = {
    $transaction: transaction,
    $disconnect: () => both((c) => c.$disconnect()),
    $connect: () => both((c) => c.$connect()),
  };
  return new Proxy(appBase, {
    get(_target, prop) {
      if (prop in own) return own[prop];
      const client = currentScope()?.kind === 'platform' ? admin : app;
      const value: unknown = Reflect.get(client, prop);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });
}
