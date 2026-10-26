import type { BookStage, Fact } from '@bookleaf/shared';

/** Plain domain inputs for the facts engine (decoupled from Prisma types). */
export interface BookRecord {
  id: string;
  externalId: string;
  title: string;
  isbn: string;
  stage: BookStage;
  publicationDate: string | null;
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

export interface AuthorRecord {
  id: string;
  externalId: string;
  name: string;
  books: BookRecord[];
}

export interface FactsInput {
  author: AuthorRecord;
  /** The book the ticket is about; null for "General / Account Level". */
  bookId: string | null;
  /** Ticket text, used only to detect which platforms the author mentions. */
  text: string;
  dataAsOf: Date;
}

export type { Fact };
