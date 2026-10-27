import { z } from 'zod';
import { ValidationError } from '../../platform/errors.js';

/** Position in a newest-first list: the last row shown. Ties on time are broken by id. */
export interface Cursor {
  at: Date;
  id: string;
}

export const encodeCursor = (c: Cursor): string =>
  Buffer.from(`${c.at.toISOString()}|${c.id}`).toString('base64url');

export function decodeCursor(text: string): Cursor {
  const [iso = '', id = ''] = Buffer.from(text, 'base64url').toString('utf8').split('|');
  const at = new Date(iso);
  if (Number.isNaN(at.getTime()) || !z.uuid().safeParse(id).success)
    throw new ValidationError('Invalid cursor');
  return { at, id };
}

/** Prisma filter for rows that come after the cursor in newest-first order. */
export const after = (c: Cursor | null) =>
  c ? { OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, id: { lt: c.id } }] } : {};

export const NEWEST_FIRST = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Newest first, the same order the database uses (uuid order matches lowercase hex order). */
export const newestFirst = (a: Cursor, b: Cursor) =>
  b.at.getTime() - a.at.getTime() || byText(b.id, a.id);
