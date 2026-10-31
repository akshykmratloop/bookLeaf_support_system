import '@fastify/cookie';
import '@fastify/rate-limit';
import type { Role, WorkspaceRole } from '@bookleaf/shared';
import type { Session } from '../../modules/auth/session.js';
import type { PlatformSession } from '../../modules/platform/session.js';

declare module 'fastify' {
  interface FastifyRequest {
    session: Session | null;
    /** Set on the super admin console's routes only (U-7). */
    platformAdmin: PlatformSession | null;
  }
  interface FastifyContextConfig {
    /** Route needs no session (login, health, docs). Everything else is denied by default. */
    public?: boolean;
    /** Roles allowed on this route; omitted means any signed-in user. */
    roles?: readonly Role[];
    /** Workspace roles (`workspace_members.role`) allowed; omitted means any member role. */
    workspaceRoles?: readonly WorkspaceRole[];
  }
}

export {};
