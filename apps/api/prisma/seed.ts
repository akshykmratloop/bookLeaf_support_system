import { z } from 'zod';
import { createDb } from '../src/platform/db.js';
import { seedCore } from '../src/seed/seed-core.js';

/** Seeds the support team's admins and AI settings. Safe to run repeatedly (upserts only). */
const SeedEnvSchema = z.object({
  DATABASE_URL: z.string().startsWith('postgres'),
  SEED_ADMIN_PASSWORD: z.string().min(8),
});

async function main(): Promise<void> {
  const env = SeedEnvSchema.parse(process.env);
  const db = createDb(env.DATABASE_URL);
  try {
    const { admins } = await seedCore(db, env.SEED_ADMIN_PASSWORD);
    console.log(`Seeded ${admins} admins. Authors appear when they sign in through the host.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
