import { z } from 'zod';

/**
 * Where every copy of the API keeps the state they share (F-19): live updates, rate limits,
 * one-use tokens, the chat queue and settings-cache clearing. Required in production.
 */
export const SharedStateConfig = z.object({
  /** e.g. redis://localhost:6380 (local Docker) or redis://redis:6379 (the Compose stack). */
  REDIS_URL: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine(
      (v) => v === undefined || /^rediss?:\/\/\S+$/.test(v),
      'must be a redis:// or rediss:// address',
    ),
  /** Every Redis key and channel starts with it, so several apps can share one Redis. */
  REDIS_KEY_PREFIX: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9:_-]{1,64}$/, 'letters, digits, ":", "_" or "-" only (1–64)')
    .default('bookleaf'),
});
