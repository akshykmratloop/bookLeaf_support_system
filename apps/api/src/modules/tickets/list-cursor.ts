import type { Prisma } from '@prisma/client';
import { PRIORITIES, TICKET_STATUSES, type TicketSort } from '@bookleaf/shared';
import { z } from 'zod';
import { ValidationError } from '../../platform/errors.js';

/**
 * A ticket list cursor is the sort key of the last row shown, not its id. Status, priority and
 * deadlines change in the background, so "resume after row X" would skip or repeat tickets once
 * X moved; "resume after this position" stays exact. Opaque to clients: base64url JSON.
 */
const UrgencyKey = z.object({
  sort: z.literal('urgency'),
  status: z.enum(TICKET_STATUSES),
  priority: z.enum(PRIORITIES),
  slaDueAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});
const TimeKey = z.object({
  sort: z.enum(['oldest', 'newest']),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});
const CursorSchema = z.discriminatedUnion('sort', [UrgencyKey, TimeKey]);
type CursorKey = z.infer<typeof CursorSchema>;

/** The fields of a ticket row a cursor is built from. */
export interface CursorRow {
  id: string;
  status: (typeof TICKET_STATUSES)[number];
  priority: (typeof PRIORITIES)[number];
  slaDueAt: Date;
  createdAt: Date;
}

export function encodeListCursor(sort: TicketSort, row: CursorRow): string {
  const time = { createdAt: row.createdAt.toISOString(), id: row.id };
  const key: CursorKey =
    sort === 'urgency'
      ? {
          sort,
          status: row.status,
          priority: row.priority,
          slaDueAt: row.slaDueAt.toISOString(),
          ...time,
        }
      : { sort, ...time };
  return Buffer.from(JSON.stringify(key)).toString('base64url');
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(Buffer.from(text, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw new ValidationError('Invalid cursor');
  }
}

/** A cursor that is malformed, or was made for a different sort, is a 422. */
export function decodeListCursor(text: string, sort: TicketSort): CursorKey {
  const parsed = CursorSchema.safeParse(parseJson(text));
  if (!parsed.success || parsed.data.sort !== sort) throw new ValidationError('Invalid cursor');
  return parsed.data;
}

/** Enum values that sort after `value` (Postgres orders enums by declaration, as these lists do). */
const later = <T extends string>(all: readonly T[], value: T): T[] =>
  all.slice(all.indexOf(value) + 1);

function afterUrgency(c: z.infer<typeof UrgencyKey>): Prisma.TicketWhereInput {
  const slaDueAt = new Date(c.slaDueAt);
  const createdAt = new Date(c.createdAt);
  const same = { status: c.status, priority: c.priority };
  return {
    OR: [
      { status: { in: later(TICKET_STATUSES, c.status) } },
      { status: c.status, priority: { in: later(PRIORITIES, c.priority) } },
      { ...same, slaDueAt: { gt: slaDueAt } },
      { ...same, slaDueAt, createdAt: { gt: createdAt } },
      { ...same, slaDueAt, createdAt, id: { gt: c.id } },
    ],
  };
}

function afterTime(c: z.infer<typeof TimeKey>): Prisma.TicketWhereInput {
  const createdAt = new Date(c.createdAt);
  const op = c.sort === 'oldest' ? 'gt' : 'lt';
  return { OR: [{ createdAt: { [op]: createdAt } }, { createdAt, id: { [op]: c.id } }] };
}

/** Rows strictly after the cursor under the same ORDER BY as `QUEUE_ORDER[sort]`. */
export function afterCursor(cursor: string | undefined, sort: TicketSort): Prisma.TicketWhereInput {
  if (!cursor) return {};
  const key = decodeListCursor(cursor, sort);
  return key.sort === 'urgency' ? afterUrgency(key) : afterTime(key);
}
