import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createDb } from '../src/platform/db.js';
import { seedCore } from '../src/seed/seed-core.js';

/** Seeds the provided dataset plus demo admins. Safe to run repeatedly (upserts only). */
const SeedEnvSchema = z.object({
  DATABASE_URL: z.string().startsWith('postgres'),
  SEED_AUTHOR_PASSWORD: z.string().min(8),
  SEED_ADMIN_PASSWORD: z.string().min(8),
});

async function main(): Promise<void> {
  const env = SeedEnvSchema.parse(process.env);
  const path = fileURLToPath(new URL('./seed-data/bookleaf_sample_data.json', import.meta.url));
  const db = createDb(env.DATABASE_URL);
  try {
    const summary = await seedCore(db, JSON.parse(readFileSync(path, 'utf8')), {
      authorPassword: env.SEED_AUTHOR_PASSWORD,
      adminPassword: env.SEED_ADMIN_PASSWORD,
    });
    console.log(
      `Seeded ${summary.authors} authors, ${summary.books} books, ${summary.admins} admins.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
