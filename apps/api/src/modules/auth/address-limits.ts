import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

const EmailField = z.object({ email: z.string() });
const WorkspaceField = z.object({ workspace: z.string().optional() });

/** The body's email, normalised; '' when the body has none (it is then refused by validation). */
export const bodyEmail = (body: unknown): string => {
  const parsed = EmailField.safeParse(body);
  return parsed.success ? parsed.data.email.trim().toLowerCase() : '';
};

const bodyWorkspace = (body: unknown): string => {
  const parsed = WorkspaceField.safeParse(body);
  return (parsed.success && parsed.data.workspace?.trim().toLowerCase()) || 'default';
};

/**
 * Per-address backstops for public routes, keyed by address AND what the request is about.
 *
 * The address alone cannot tell people apart: behind Vercel every visitor reaches the API from
 * the same few proxy addresses, so an address-only limit lets one person block everyone's sign
 * in. X-Forwarded-For cannot be trusted either, because the API host is also reachable directly
 * and anyone can send that header. So the address is only a hint, and each key adds the email
 * (or workspace) the request is for: two people on one address never share a limit. Password
 * guessing itself is limited per account by the login throttle; hand-over tokens are signed and
 * single-use; signups also have a platform-wide cap.
 *
 * `hook: 'preHandler'` runs the limit after the body is parsed, so the key can read it.
 */
function keyedLimit(max: number, timeWindow: string, key: (req: FastifyRequest) => string) {
  return { max, timeWindow, hook: 'preHandler' as const, keyGenerator: key };
}

/** Sign-in: per address and email typed. */
export const perAddressAndEmail = (name: string, max: number, timeWindow: string) =>
  keyedLimit(max, timeWindow, (req) => `${name}:${req.ip}:${bodyEmail(req.body)}`);

/** Host hand-over: per address and workspace (the body's slug, or the default workspace). */
export const perAddressAndWorkspace = (name: string, max: number, timeWindow: string) =>
  keyedLimit(max, timeWindow, (req) => `${name}:${req.ip}:${bodyWorkspace(req.body)}`);
