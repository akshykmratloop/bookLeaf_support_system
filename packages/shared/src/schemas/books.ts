import { z } from 'zod';
import { BOOK_STAGES } from '../enums.js';

/** Money is always integer paise; null means "unknown / not set", never zero. */
export const BookSchema = z.object({
  id: z.uuid(),
  externalId: z.string(),
  title: z.string(),
  isbn: z.string(),
  genre: z.string(),
  publicationDate: z.iso.date().nullable(),
  stage: z.enum(BOOK_STAGES),
  mrpPaise: z.int().nullable(),
  royaltyPerCopyPaise: z.int().nullable(),
  copiesSold: z.int(),
  royaltyEarnedPaise: z.int(),
  royaltyPaidPaise: z.int(),
  royaltyPendingPaise: z.int(),
  lastPayoutDate: z.iso.date().nullable(),
  printPartner: z.string().nullable(),
  availableOn: z.array(z.string()),
  authorName: z.string(),
});
export type Book = z.infer<typeof BookSchema>;

export const BookListSchema = z.object({ items: z.array(BookSchema) });
