import { Prisma, PrismaClient } from '@prisma/client';

export type Db = PrismaClient;

export function createDb(url: string): Db {
  return new PrismaClient({ datasources: { db: { url } } });
}

/** True when an insert hit a unique constraint, e.g. a replayed request or a lost race. */
export const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
