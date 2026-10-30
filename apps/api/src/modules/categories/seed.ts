import type { Prisma } from '@prisma/client';
import type { Db } from '../../platform/db.js';
import {
  BOOKLEAF_ARTICLES,
  BOOKLEAF_CATEGORIES,
  STARTER_CATEGORY,
  type CategorySeed,
} from './bookleaf-knowledge.js';

type Writer = Db | Prisma.TransactionClient;

/** Create-only: an admin's later edits to a seeded category are never overwritten. */
async function upsertCategory(db: Writer, workspaceId: string, c: CategorySeed, position: number) {
  await db.category.upsert({
    where: { workspaceId_key: { workspaceId, key: c.key } },
    update: {},
    create: { ...c, workspaceId, position },
  });
}

/** A new workspace starts with one General Inquiry category (inside the signup transaction). */
export async function createStarterCategory(tx: Writer, workspaceId: string): Promise<void> {
  await upsertCategory(tx, workspaceId, STARTER_CATEGORY, 0);
}

/**
 * BookLeaf's six categories and its knowledge base as linked articles (S.9). Idempotent:
 * categories are upserted create-only, and the articles are written only into an empty
 * knowledge base, so a re-run (every deploy runs the seed) never duplicates or undoes edits.
 */
export async function seedBookleafKnowledge(db: Db, workspaceId: string): Promise<void> {
  for (const [position, c] of BOOKLEAF_CATEGORIES.entries())
    await upsertCategory(db, workspaceId, c, position);
  await db.$transaction(async (tx) => {
    // Serialises concurrent seed runs on this workspace, so the empty check cannot race.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`kb-seed:${workspaceId}`}))`;
    if (await tx.knowledgeArticle.count({ where: { workspaceId } })) return;
    for (const [position, a] of BOOKLEAF_ARTICLES.entries())
      await tx.knowledgeArticle.create({
        data: {
          workspaceId,
          title: a.title,
          body: a.body,
          position,
          categories: { create: a.categoryKeys.map((categoryKey) => ({ categoryKey })) },
        },
      });
  });
}
