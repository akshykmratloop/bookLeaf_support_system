import { z } from 'zod';
import { createDb } from '../src/platform/db.js';
import { ensurePlatformAdmin, platformAdminFromEnv } from '../src/modules/platform/admins.js';
import { seedCore } from '../src/seed/seed-core.js';

/**
 * Seeds the support team's admins, the platform AI settings and the super admin account of the
 * console (/platform, U-7) from PLATFORM_ADMIN_EMAIL + PLATFORM_ADMIN_PASSWORD. Safe to run
 * repeatedly (upserts only); every deploy runs it. Runs as the owner (DATABASE_ADMIN_URL).
 */
const SeedEnvSchema = z.object({
  DATABASE_ADMIN_URL: z.string().startsWith('postgres'),
  SEED_ADMIN_PASSWORD: z.string().min(8),
  PLATFORM_ADMIN_EMAIL: z.string().optional(),
  PLATFORM_ADMIN_PASSWORD: z.string().optional(),
});

async function main(): Promise<void> {
  const env = SeedEnvSchema.parse(process.env);
  const superAdmin = platformAdminFromEnv(env);
  const db = createDb(env.DATABASE_ADMIN_URL);
  try {
    const { admins } = await seedCore(db, env.SEED_ADMIN_PASSWORD);
    console.log(`Seeded ${admins} admins. Authors appear when they sign in through the host.`);
    if (superAdmin) {
      await ensurePlatformAdmin(db, superAdmin);
      console.log(`Super admin ${superAdmin.email} is ready (sign in at /platform/login).`);
    } else {
      console.warn('No PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD: no super admin account.');
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
