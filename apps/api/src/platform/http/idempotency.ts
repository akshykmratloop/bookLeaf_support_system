import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '../errors.js';

const KeySchema = z.uuid();

/** Optional Idempotency-Key header (UUID). A repeated key returns the first result instead of a duplicate. */
export function idempotencyKey(req: FastifyRequest): string | null {
  const raw = req.headers['idempotency-key'];
  if (raw === undefined) return null;
  const parsed = KeySchema.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!parsed.success)
    throw new ValidationError('Idempotency-Key must be a UUID', [
      { path: 'Idempotency-Key', message: 'Must be a UUID' },
    ]);
  return parsed.data;
}
