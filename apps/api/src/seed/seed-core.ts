import type { Db } from '../platform/db.js';
import { parseIsoDate } from '../platform/clock.js';
import { hashPassword } from '../modules/auth/password.js';
import { DEFAULT_AI_SETTINGS } from '../ai/providers/catalog.js';
import { DEMO_ADMINS } from './demo-accounts.js';
import { SampleDataSchema, toSeedBook, type RawAuthor } from './sample-data.js';

export interface SeedOptions {
  authorPassword: string;
  adminPassword: string;
}

export interface SeedSummary {
  authors: number;
  books: number;
  admins: number;
}

const dateOrNull = (v: string | null) => (v === null ? null : parseIsoDate(v));

async function seedAuthor(db: Db, raw: RawAuthor, passwordHash: string): Promise<number> {
  const email = raw.email.toLowerCase();
  const user = await db.user.upsert({
    where: { email },
    update: { name: raw.name },
    create: { email, name: raw.name, role: 'AUTHOR', passwordHash },
  });
  const author = await db.author.upsert({
    where: { externalId: raw.author_id },
    update: { phone: raw.phone, city: raw.city },
    create: {
      externalId: raw.author_id,
      userId: user.id,
      phone: raw.phone,
      city: raw.city,
      joinedDate: parseIsoDate(raw.joined_date),
    },
  });
  for (const rawBook of raw.books) {
    const b = toSeedBook(rawBook);
    const data = {
      ...b,
      authorId: author.id,
      publicationDate: dateOrNull(b.publicationDate),
      lastPayoutDate: dateOrNull(b.lastPayoutDate),
    };
    await db.book.upsert({ where: { externalId: b.externalId }, update: data, create: data });
  }
  return raw.books.length;
}

/** Idempotent: running it twice leaves the same rows. Validates the dataset before writing. */
export async function seedCore(db: Db, input: unknown, opts: SeedOptions): Promise<SeedSummary> {
  const data = SampleDataSchema.parse(input);
  data.authors.forEach((a) => a.books.forEach(toSeedBook));
  const [authorHash, adminHash] = await Promise.all([
    hashPassword(opts.authorPassword),
    hashPassword(opts.adminPassword),
  ]);
  let books = 0;
  for (const raw of data.authors) books += await seedAuthor(db, raw, authorHash);
  for (const admin of DEMO_ADMINS) {
    await db.user.upsert({
      where: { email: admin.email },
      update: { name: admin.name },
      create: { ...admin, role: 'ADMIN', passwordHash: adminHash },
    });
  }
  await db.aiSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULT_AI_SETTINGS },
  });
  return { authors: data.authors.length, books, admins: DEMO_ADMINS.length };
}
