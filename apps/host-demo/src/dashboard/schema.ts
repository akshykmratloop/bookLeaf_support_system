import { BOOK_STAGES, ROYALTY_STATUSES } from '@bookleaf/shared';
import { z } from 'zod';

/**
 * BookLeaf's own author dashboard (not part of the support contract). Money is in paise; dates
 * are YYYY-MM-DD on BookLeaf's business clock (DATA_AS_OF).
 */
export const DashboardBookSchema = z.object({
  id: z.string(),
  title: z.string(),
  isbn: z.string(),
  genre: z.string(),
  publicationDate: z.iso.date().nullable(),
  stage: z.enum(BOOK_STAGES),
  /** 0-based position in BOOK_STAGES; the last stage means the book is live. */
  stageIndex: z.int().min(0),
  live: z.boolean(),
  mrpPaise: z.int().nullable(),
  royaltyPerCopyPaise: z.int().nullable(),
  copiesSold: z.int().min(0),
  royaltyEarnedPaise: z.int().min(0),
  royaltyPaidPaise: z.int().min(0),
  royaltyPendingPaise: z.int().min(0),
  lastPayoutDate: z.iso.date().nullable(),
  printPartner: z.string().nullable(),
  availableOn: z.array(z.string()),
  royaltyStatus: z.enum(ROYALTY_STATUSES),
  /** Days since a payout deadline passed without a payout; null unless possibly overdue. */
  overdueDays: z.int().nullable(),
});
export type DashboardBook = z.infer<typeof DashboardBookSchema>;

export const DashboardSchema = z.object({
  asOf: z.iso.date(),
  profile: z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    phone: z.string(),
    city: z.string(),
    memberSince: z.iso.date(),
  }),
  totals: z.object({
    books: z.int(),
    liveBooks: z.int(),
    inProduction: z.int(),
    copiesSold: z.int(),
    earnedPaise: z.int(),
    paidPaise: z.int(),
    pendingPaise: z.int(),
  }),
  payout: z.object({
    eligible: z.boolean(),
    thresholdPaise: z.int(),
    /** Pending total as a share of the threshold, 0–100. */
    progressPercent: z.int().min(0).max(100),
    nextCycleDeadline: z.iso.date(),
    daysToDeadline: z.int(),
    overdueBookIds: z.array(z.string()),
  }),
  books: z.array(DashboardBookSchema),
});
export type Dashboard = z.infer<typeof DashboardSchema>;
