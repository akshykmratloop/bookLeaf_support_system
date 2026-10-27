import type { Db } from '../platform/db.js';
import { hashPassword } from '../modules/auth/password.js';
import { DEFAULT_AI_SETTINGS } from '../ai/providers/catalog.js';
import { DEMO_ADMINS } from './demo-accounts.js';

/**
 * The support module's own starting data: the support team's admin accounts and the default
 * AI settings. Authors and books are not seeded here: they belong to the host product and
 * appear when an author first signs in through it. Idempotent (upserts only).
 */
export async function seedCore(db: Db, adminPassword: string): Promise<{ admins: number }> {
  const passwordHash = await hashPassword(adminPassword);
  for (const admin of DEMO_ADMINS) {
    await db.user.upsert({
      where: { email: admin.email },
      update: { name: admin.name },
      create: { ...admin, role: 'ADMIN', passwordHash },
    });
  }
  await db.aiSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULT_AI_SETTINGS },
  });
  return { admins: DEMO_ADMINS.length };
}
