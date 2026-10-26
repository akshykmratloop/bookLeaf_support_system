import { z } from 'zod';
import { ROLES } from '../enums.js';

export const LoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().min(5).max(254)),
  password: z.string().min(8).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
  authorId: z.uuid().nullable(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;
