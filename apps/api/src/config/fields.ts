import { z } from 'zod';

/** A whole number read from an env string, within limits, with a default. */
export const int = (min: number, max: number, fallback: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

/** An optional secret: an empty value counts as not set. */
export const optionalSecret = () =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined));

/** `true` / `false` read from an env string. */
export const flag = (fallback: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(fallback)
    .transform((v) => v === 'true');
