import { ensurePlatformAdmin } from '../../src/modules/platform/admins.js';
import { call, type Harness } from './app.js';

/** The super admin every platform test signs in as (created the way deploys create it). */
export const SUPER = { email: 'owner@support.example', password: 'Platform-Owner-42' };

export async function seedSuperAdmin(h: Harness, password = SUPER.password): Promise<void> {
  await ensurePlatformAdmin(h.db, { email: SUPER.email, password });
}

/** Signs in on /platform/login and returns the platform cookie. */
export async function platformLogin(
  h: Harness,
  email = SUPER.email,
  password = SUPER.password,
): Promise<string> {
  const res = await call(h, 'POST', '/platform/auth/login', undefined, { email, password });
  if (res.statusCode !== 200) throw new Error(`platform login failed: ${res.statusCode}`);
  const cookie = res.cookies.find((c) => c.name === 'bl_platform');
  if (!cookie) throw new Error('no platform cookie');
  return `bl_platform=${cookie.value}`;
}

/**
 * A console cookie issued directly (stays under the sign-in rate limit, like ownerCookie). The
 * sign-in itself is covered in platform-auth.int.test.ts.
 */
export async function platformCookie(h: Harness): Promise<string> {
  const admin = await h.db.platformAdmin.findUniqueOrThrow({ where: { email: SUPER.email } });
  const token = await h.container.platformConsole.sessions.sign({
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
  });
  return `bl_platform=${token}`;
}

/** The current plan version of a customer, for an update. */
export async function planVersion(h: Harness, workspaceId: string): Promise<number> {
  const plan = await h.db.workspacePlan.findUniqueOrThrow({ where: { workspaceId } });
  return plan.version;
}

export async function updatePlan(
  h: Harness,
  cookie: string,
  workspaceId: string,
  patch: Record<string, unknown>,
) {
  const version = await planVersion(h, workspaceId);
  return call(h, 'PUT', `/platform/customers/${workspaceId}/plan`, cookie, { version, ...patch });
}
