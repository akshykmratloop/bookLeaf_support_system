import '@fastify/cookie';
import '@fastify/rate-limit';
import type { Role } from '@bookleaf/shared';
import type { Session } from '../../modules/auth/session.js';

declare module 'fastify' {
  interface FastifyRequest {
    session: Session | null;
  }
  interface FastifyContextConfig {
    /** Route needs no session (login, health, docs). Everything else is denied by default. */
    public?: boolean;
    /** Roles allowed on this route; omitted means any signed-in user. */
    roles?: readonly Role[];
  }
}

export {};
