import type { Book as BookRow, Prisma } from '@prisma/client';
import type { Book } from '@bookleaf/shared';
import { toIsoDate } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';

type BookWithAuthor = BookRow & { author: { user: { name: string } } };

const include = {
  author: { include: { user: { select: { name: true } } } },
} satisfies Prisma.BookInclude;

export function toBookDto(b: BookWithAuthor): Book {
  return {
    id: b.id,
    externalId: b.externalId,
    title: b.title,
    isbn: b.isbn,
    genre: b.genre,
    publicationDate: b.publicationDate ? toIsoDate(b.publicationDate) : null,
    stage: b.stage,
    mrpPaise: b.mrpPaise,
    royaltyPerCopyPaise: b.royaltyPerCopyPaise,
    copiesSold: b.copiesSold,
    royaltyEarnedPaise: b.royaltyEarnedPaise,
    royaltyPaidPaise: b.royaltyPaidPaise,
    royaltyPendingPaise: b.royaltyPendingPaise,
    lastPayoutDate: b.lastPayoutDate ? toIsoDate(b.lastPayoutDate) : null,
    printPartner: b.printPartner,
    availableOn: b.availableOn,
    authorName: b.author.user.name,
  };
}

/** Authors see only their own books; admins see all. Someone else's book is "not found". */
export function scopeFor(session: Session): Prisma.BookWhereInput {
  return session.role === 'ADMIN'
    ? {}
    : { authorId: session.authorId ?? '00000000-0000-0000-0000-000000000000' };
}

export function createBooksRepository(db: Db) {
  return {
    async list(session: Session): Promise<Book[]> {
      const rows = await db.book.findMany({
        where: scopeFor(session),
        include,
        orderBy: [{ publicationDate: { sort: 'desc', nulls: 'first' } }, { title: 'asc' }],
      });
      return rows.map(toBookDto);
    },
    async get(session: Session, id: string): Promise<Book> {
      const row = await db.book.findFirst({ where: { id, ...scopeFor(session) }, include });
      if (!row) throw new NotFoundError('Book');
      return toBookDto(row);
    },
  };
}

export type BooksRepository = ReturnType<typeof createBooksRepository>;
