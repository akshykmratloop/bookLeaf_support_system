import { Prisma, PrismaClient } from '@prisma/client';

export type Db = PrismaClient;

export function createDb(url: string): Db {
  return new PrismaClient({ datasources: { db: { url } } });
}

/** True when an insert hit a unique constraint, e.g. a replayed request or a lost race. */
export const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** True when the unique constraint that was hit covers this column (e.g. `login_email`). */
export function isUniqueViolationOn(err: unknown, column: string): boolean {
  if (!isUniqueViolation(err)) return false;
  const target = (err as Prisma.PrismaClientKnownRequestError).meta?.target;
  if (Array.isArray(target)) return target.some((t) => String(t).includes(column));
  return typeof target === 'string' && target.includes(column);
}
