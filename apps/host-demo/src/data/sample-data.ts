import { z } from 'zod';
import { BOOK_STAGES, STAGE_LABELS, type BookStage } from '@bookleaf/shared';

/** Shape of `bookleaf_sample_data.json`, exactly as provided by BookLeaf. */
const RawBookSchema = z.object({
  book_id: z.string(),
  title: z.string(),
  isbn: z.string(),
  genre: z.string(),
  publication_date: z.iso.date().nullable(),
  status: z.string(),
  mrp: z.number().nullable(),
  author_royalty_per_copy: z.number().nullable(),
  total_copies_sold: z.number().int(),
  total_royalty_earned: z.number(),
  royalty_paid: z.number(),
  royalty_pending: z.number(),
  last_royalty_payout_date: z.iso.date().nullable(),
  print_partner: z.string().nullable(),
  available_on: z.array(z.string()),
});

const RawAuthorSchema = z.object({
  author_id: z.string(),
  name: z.string(),
  email: z.email(),
  phone: z.string(),
  city: z.string(),
  joined_date: z.iso.date(),
  books: z.array(RawBookSchema),
});

export const SampleDataSchema = z.object({ authors: z.array(RawAuthorSchema) });
export type RawAuthor = z.infer<typeof RawAuthorSchema>;
export type RawBook = z.infer<typeof RawBookSchema>;

export interface BookFields {
  externalId: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: string | null;
  stage: BookStage;
  mrpPaise: number | null;
  royaltyPerCopyPaise: number | null;
  copiesSold: number;
  royaltyEarnedPaise: number;
  royaltyPaidPaise: number;
  royaltyPendingPaise: number;
  lastPayoutDate: string | null;
  printPartner: string | null;
  availableOn: string[];
}

const toPaise = (rupees: number): number => Math.round(rupees * 100);
const toPaiseOrNull = (rupees: number | null): number | null =>
  rupees === null ? null : toPaise(rupees);

/** Maps "Published & Live" / "In Production - Cover Design" to the stage enum. */
export function mapStage(status: string): BookStage {
  const label = status.replace(/^In Production\s*-\s*/i, '').trim();
  const stage = BOOK_STAGES.find((s) => STAGE_LABELS[s].toLowerCase() === label.toLowerCase());
  if (!stage) throw new Error(`Unknown book status "${status}"`);
  return stage;
}

/** Fails loudly if the provided data breaks its own arithmetic. */
export function assertBookInvariants(book: RawBook): void {
  const { total_royalty_earned: earned, royalty_paid: paid, royalty_pending: pending } = book;
  if (paid + pending !== earned) {
    throw new Error(`${book.book_id}: paid + pending (${paid + pending}) != earned (${earned})`);
  }
  const perCopy = book.author_royalty_per_copy;
  if (perCopy !== null && perCopy * book.total_copies_sold !== earned) {
    throw new Error(`${book.book_id}: copies × per-copy royalty != earned`);
  }
}

export function toBookFields(book: RawBook): BookFields {
  assertBookInvariants(book);
  return {
    externalId: book.book_id,
    title: book.title,
    isbn: book.isbn,
    genre: book.genre,
    publicationDate: book.publication_date,
    stage: mapStage(book.status),
    mrpPaise: toPaiseOrNull(book.mrp),
    royaltyPerCopyPaise: toPaiseOrNull(book.author_royalty_per_copy),
    copiesSold: book.total_copies_sold,
    royaltyEarnedPaise: toPaise(book.total_royalty_earned),
    royaltyPaidPaise: toPaise(book.royalty_paid),
    royaltyPendingPaise: toPaise(book.royalty_pending),
    lastPayoutDate: book.last_royalty_payout_date,
    printPartner: book.print_partner,
    availableOn: book.available_on,
  };
}
