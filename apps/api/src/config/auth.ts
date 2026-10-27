import { z } from 'zod';
import { int } from './fields.js';

/** Signed session cookie. */
export const AuthConfig = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: int(1, 72, 8),
});
