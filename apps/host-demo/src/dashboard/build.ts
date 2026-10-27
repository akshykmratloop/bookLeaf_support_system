import { BOOK_STAGES } from '@bookleaf/shared';
import type { AuthorAccount } from '../data/authors.js';
import { PAYOUT_THRESHOLD_PAISE } from '../facts/kb-constants.js';
import { daysBetween } from '../facts/payout-calendar.js';
import { assessRoyalty } from '../facts/royalty.js';
import type { AuthorRecord, BookRecord } from '../facts/types.js';
import type { Dashboard, DashboardBook } from './schema.js';

const LAST_STAGE = BOOK_STAGES.length - 1;
const sum = (books: BookRecord[], pick: (b: BookRecord) => number) =>
  books.reduce((total, b) => total + pick(b), 0);

function toBook(author: AuthorRecord, b: BookRecord, asOf: Date): DashboardBook {
  const royalty = assessRoyalty(author, b, asOf);
  const stageIndex = BOOK_STAGES.indexOf(b.stage);
  return {
    id: b.externalId,
    title: b.title,
    isbn: b.isbn,
    genre: b.genre,
    publicationDate: b.publicationDate,
    stage: b.stage,
    stageIndex,
    live: stageIndex === LAST_STAGE,
    mrpPaise: b.mrpPaise,
    royaltyPerCopyPaise: b.royaltyPerCopyPaise,
    copiesSold: b.copiesSold,
    royaltyEarnedPaise: b.royaltyEarnedPaise,
    royaltyPaidPaise: b.royaltyPaidPaise,
    royaltyPendingPaise: b.royaltyPendingPaise,
    lastPayoutDate: b.lastPayoutDate,
    printPartner: b.printPartner,
    availableOn: b.availableOn,
    royaltyStatus: royalty.bookStatus ?? 'NOTHING_PENDING',
    overdueDays: royalty.overdueDays,
  };
}

function totalsOf(books: DashboardBook[], record: AuthorRecord): Dashboard['totals'] {
  const live = books.filter((b) => b.live).length;
  return {
    books: books.length,
    liveBooks: live,
    inProduction: books.length - live,
    copiesSold: sum(record.books, (b) => b.copiesSold),
    earnedPaise: sum(record.books, (b) => b.royaltyEarnedPaise),
    paidPaise: sum(record.books, (b) => b.royaltyPaidPaise),
    pendingPaise: sum(record.books, (b) => b.royaltyPendingPaise),
  };
}

/** The author's dashboard, from the same records and rules the support facts use. */
export function buildDashboard(account: AuthorAccount, asOf: Date): Dashboard {
  const { record, profile } = account;
  const books = record.books.map((b) => toBook(record, b, asOf));
  const overall = assessRoyalty(record, null, asOf);
  const pending = overall.authorTotalPendingPaise;
  return {
    asOf: asOf.toISOString().slice(0, 10),
    profile: { id: record.externalId, name: record.name, email: account.email, ...profile },
    totals: totalsOf(books, record),
    payout: {
      eligible: overall.payoutEligible,
      thresholdPaise: PAYOUT_THRESHOLD_PAISE,
      progressPercent: Math.min(100, Math.floor((pending / PAYOUT_THRESHOLD_PAISE) * 100)),
      nextCycleDeadline: overall.nextCycleDeadline,
      daysToDeadline: daysBetween(asOf, new Date(`${overall.nextCycleDeadline}T00:00:00Z`)),
      overdueBookIds: books.filter((b) => b.royaltyStatus === 'POSSIBLY_OVERDUE').map((b) => b.id),
    },
    books,
  };
}
