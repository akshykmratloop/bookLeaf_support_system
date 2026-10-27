import { z } from 'zod';

import { HostDetailSchema } from './host.js';

/** A book as the support module knows it: our reference id plus the host's live details. */
export const BookSchema = z.object({
  id: z.uuid(),
  externalId: z.string(),
  title: z.string(),
  authorName: z.string(),
  /** What the host shows about the book. Empty while the host is unavailable, and for admins. */
  details: z.array(HostDetailSchema),
});
export type Book = z.infer<typeof BookSchema>;

export const BookListSchema = z.object({
  items: z.array(BookSchema),
  /** Account-level lines from the host (e.g. total royalty pending). */
  account: z.array(HostDetailSchema),
});
export type BookList = z.infer<typeof BookListSchema>;
