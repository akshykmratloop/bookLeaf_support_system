import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AuthorRecord } from '../../src/ai/facts/index.js';
import { SampleDataSchema, toSeedBook } from '../../src/seed/sample-data.js';

const path = fileURLToPath(new URL('../../prisma/seed-data/bookleaf_sample_data.json', import.meta.url));
export const SAMPLE = SampleDataSchema.parse(JSON.parse(readFileSync(path, 'utf8')));

/** The seed authors as facts-engine records; book ids are the external ids (BK001…). */
export function sampleAuthor(authorExternalId: string): AuthorRecord {
  const raw = SAMPLE.authors.find((a) => a.author_id === authorExternalId);
  if (!raw) throw new Error(`No sample author ${authorExternalId}`);
  return {
    id: raw.author_id,
    externalId: raw.author_id,
    name: raw.name,
    books: raw.books.map((b) => ({ ...toSeedBook(b), id: b.book_id })),
  };
}
