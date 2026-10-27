import type { Prisma } from '@prisma/client';
import type { Book, BookList, HostCustomer } from '@bookleaf/shared';
import { customerOrNull } from '../../host/facts.js';
import type { HostRecords } from '../../host/types.js';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import { authorIdOf, type Session } from '../auth/session.js';

const include = {
  author: { select: { user: { select: { name: true } } } },
} satisfies Prisma.BookInclude;
type BookRow = Prisma.BookGetPayload<{ include: typeof include }>;

const toBook = (b: BookRow, customer: HostCustomer | null): Book => ({
  id: b.id,
  externalId: b.externalId,
  title: b.title,
  authorName: b.author.user.name,
  details: customer?.items.find((i) => i.id === b.externalId)?.details ?? [],
});

/** Authors see only their own books (someone else's is "not found"); admins see all. */
const scopeFor = (s: Session): Prisma.BookWhereInput =>
  s.role === 'ADMIN' ? {} : { authorId: authorIdOf(s) };

export function createBooksService(deps: { db: Db; records: HostRecords }) {
  /** Details come from the host, asked once for the signed-in author (admins get titles only). */
  const customerOf = async (s: Session) => {
    if (s.role !== 'AUTHOR') return null;
    const author = await deps.db.author.findUniqueOrThrow({ where: { id: authorIdOf(s) } });
    return customerOrNull(deps.records, author.externalId);
  };
  return {
    async list(session: Session): Promise<BookList> {
      const rows = await deps.db.book.findMany({
        where: scopeFor(session),
        include,
        orderBy: { externalId: 'asc' },
      });
      const customer = await customerOf(session);
      return { items: rows.map((b) => toBook(b, customer)), account: customer?.details ?? [] };
    },
    async get(session: Session, id: string): Promise<Book> {
      const row = await deps.db.book.findFirst({ where: { id, ...scopeFor(session) }, include });
      if (!row) throw new NotFoundError('Book');
      return toBook(row, await customerOf(session));
    },
  };
}

export type BooksService = ReturnType<typeof createBooksService>;
