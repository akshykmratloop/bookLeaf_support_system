import { readFileSync } from 'node:fs';
import type { AuthorRecord } from '../facts/index.js';
import { SampleDataSchema, toBookFields } from './sample-data.js';

/** A BookLeaf author account: who they are and their books, as the facts engine reads them. */
export interface AuthorAccount {
  email: string;
  record: AuthorRecord;
  /** Shown on BookLeaf's own dashboard only; never sent to the support module. */
  profile: { phone: string; city: string; memberSince: string };
}

const SAMPLE_FILE = new URL('./sample-data.json', import.meta.url);

/** BookLeaf's sample dataset, checked against its own arithmetic. Book ids are BK001…. */
export function loadAuthors(file: URL = SAMPLE_FILE): AuthorAccount[] {
  const data = SampleDataSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  return data.authors.map((a) => ({
    email: a.email.toLowerCase(),
    profile: { phone: a.phone, city: a.city, memberSince: a.joined_date },
    record: {
      id: a.author_id,
      externalId: a.author_id,
      name: a.name,
      books: a.books.map((b) => ({ ...toBookFields(b), id: b.book_id })),
    },
  }));
}

export const findById = (authors: AuthorAccount[], id: string) =>
  authors.find((a) => a.record.externalId === id) ?? null;

export const findByEmail = (authors: AuthorAccount[], email: string) =>
  authors.find((a) => a.email === email.trim().toLowerCase()) ?? null;
