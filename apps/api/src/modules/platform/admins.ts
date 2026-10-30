import { PasswordSchema } from '@bookleaf/shared';
import { z } from 'zod';
import type { Db } from '../../platform/db.js';
import { asPlatform } from '../../platform/tenancy.js';
import { hashPassword, verifyPassword } from '../auth/password.js';

/**
 * The support provider's super admin accounts (U-7). There is no signup: each deploy creates or
 * updates the account named by PLATFORM_ADMIN_EMAIL with PLATFORM_ADMIN_PASSWORD (seed). A
 * changed password ends that admin's existing platform sessions.
 */
const PlatformAdminEnvSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().min(5).max(254)),
  password: PasswordSchema,
  name: z.string().trim().min(1).max(80).default('Support owner'),
});
export type PlatformAdminInput = z.input<typeof PlatformAdminEnvSchema>;

/** Creates the account, or brings an existing one up to date. Idempotent; owner connection only. */
export async function ensurePlatformAdmin(db: Db, input: PlatformAdminInput): Promise<void> {
  const { email, password, name } = PlatformAdminEnvSchema.parse(input);
  await asPlatform(async () => {
    const existing = await db.platformAdmin.findUnique({ where: { email } });
    if (!existing) {
      await db.platformAdmin.create({
        data: { email, name, passwordHash: await hashPassword(password) },
      });
      return;
    }
    if (await verifyPassword(existing.passwordHash, password)) {
      if (existing.name !== name)
        await db.platformAdmin.update({ where: { email }, data: { name } });
      return;
    }
    await db.platformAdmin.update({
      where: { email },
      data: {
        name,
        passwordHash: await hashPassword(password),
        sessionVersion: { increment: 1 },
      },
    });
  });
}

/** The seed's view of the env: both values set → ensure the account; neither → nothing to do. */
export function platformAdminFromEnv(env: {
  PLATFORM_ADMIN_EMAIL?: string;
  PLATFORM_ADMIN_PASSWORD?: string;
}): PlatformAdminInput | null {
  const email = env.PLATFORM_ADMIN_EMAIL?.trim();
  const password = env.PLATFORM_ADMIN_PASSWORD;
  if (!email && !password) return null;
  if (!email || !password)
    throw new Error('Set both PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD, or neither');
  return { email, password };
}
