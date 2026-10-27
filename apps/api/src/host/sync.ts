import type { Prisma } from '@prisma/client';
import type { HostCustomer } from '@bookleaf/shared';
import type { Db } from '../platform/db.js';
import { ConflictError } from '../platform/errors.js';

type Tx = Prisma.TransactionClient;

export interface SyncedAuthor {
  workspaceId: string;
  authorId: string;
  userId: string;
}

const EMAIL_IN_USE = () =>
  new ConflictError('EMAIL_IN_USE', 'This email already belongs to another account here.');

async function upsertAuthor(tx: Tx, workspaceId: string, c: HostCustomer) {
  const email = c.email.toLowerCase();
  const existing = await tx.author.findUnique({
    where: { workspaceId_externalId: { workspaceId, externalId: c.id } },
  });
  const owner = await tx.user.findUnique({ where: { workspaceId_email: { workspaceId, email } } });
  if (owner && owner.id !== existing?.userId) throw EMAIL_IN_USE();
  if (existing) {
    await tx.user.update({ where: { id: existing.userId }, data: { name: c.name, email } });
    return { authorId: existing.id, userId: existing.userId };
  }
  const user = await tx.user.create({
    data: { workspaceId, email, name: c.name, role: 'AUTHOR' },
  });
  const author = await tx.author.create({
    data: { workspaceId, externalId: c.id, userId: user.id },
  });
  return { authorId: author.id, userId: user.id };
}

const ITEM_ELSEWHERE = () =>
  new ConflictError('ITEM_OWNED_ELSEWHERE', 'An item in this account belongs to another account.');

/** Adds or renames one item. An item never moves between authors: that is a host mix-up. */
async function syncItem(tx: Tx, owner: SyncedAuthor, item: { id: string; title: string }) {
  const where = { workspaceId_externalId: { workspaceId: owner.workspaceId, externalId: item.id } };
  const existing = await tx.book.findUnique({ where });
  if (existing && existing.authorId !== owner.authorId) throw ITEM_ELSEWHERE();
  await tx.book.upsert({
    where,
    update: { title: item.title },
    create: {
      workspaceId: owner.workspaceId,
      externalId: item.id,
      title: item.title,
      authorId: owner.authorId,
    },
  });
}

/**
 * Keeps a small reference copy of the customer and their items (ids, names, titles) so
 * tickets, chats and calls can point at them. Facts are never copied: they are read live.
 */
export async function syncCustomer(
  db: Db,
  workspaceId: string,
  c: HostCustomer,
): Promise<SyncedAuthor> {
  return db.$transaction(async (tx) => {
    const ids = { workspaceId, ...(await upsertAuthor(tx, workspaceId, c)) };
    for (const item of c.items) await syncItem(tx, ids, item);
    return ids;
  });
}
