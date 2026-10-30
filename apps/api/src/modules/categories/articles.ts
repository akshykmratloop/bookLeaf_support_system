import type { Article, CreateArticleSchema, UpdateArticleSchema } from '@bookleaf/shared';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { Db } from '../../platform/db.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { assertSameRows, lockWorkspace, nextPosition, type Tx } from './order.js';

export type CreateArticleInput = z.output<typeof CreateArticleSchema>;
export type UpdateArticleInput = z.output<typeof UpdateArticleSchema>;

const WITH_LINKS = {
  categories: { select: { categoryKey: true }, orderBy: { categoryKey: 'asc' } },
} satisfies Prisma.KnowledgeArticleInclude;
type Row = Prisma.KnowledgeArticleGetPayload<{ include: typeof WITH_LINKS }>;

const ORDER = [{ position: 'asc' as const }, { createdAt: 'asc' as const }];

export const toArticleDto = (a: Row): Article => ({
  id: a.id,
  title: a.title,
  body: a.body,
  categoryKeys: a.categories.map((c) => c.categoryKey),
  position: a.position,
  isActive: a.isActive,
  updatedAt: a.updatedAt.toISOString(),
});

/** Links may only point at this workspace's own categories (the foreign key enforces it too). */
async function assertOwnCategories(tx: Tx, workspaceId: string, keys: readonly string[]) {
  if (keys.length === 0) return;
  const found = await tx.category.count({ where: { workspaceId, key: { in: [...keys] } } });
  if (found !== keys.length)
    throw new ValidationError('Link the article to this workspace’s own categories.', [
      { path: 'categoryKeys', message: 'Not a category of this workspace' },
    ]);
}

async function audit(tx: Tx, session: Session, action: string, a: Row) {
  await tx.auditEvent.create({
    data: {
      workspaceId: session.workspaceId,
      actorId: session.userId,
      entityType: 'knowledge_article',
      entityId: a.id,
      action,
      after: { title: a.title, isActive: a.isActive, categoryKeys: toArticleDto(a).categoryKeys },
    },
  });
}

export function listArticles(db: Db, session: Session): Promise<Row[]> {
  return db.knowledgeArticle.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: ORDER,
    include: WITH_LINKS,
  });
}

export async function createArticle(db: Db, session: Session, input: CreateArticleInput) {
  const workspaceId = session.workspaceId;
  return db.$transaction(async (tx) => {
    await lockWorkspace(tx, workspaceId);
    await assertOwnCategories(tx, workspaceId, input.categoryKeys);
    const last = await tx.knowledgeArticle.aggregate({
      where: { workspaceId },
      _max: { position: true },
    });
    const a = await tx.knowledgeArticle.create({
      data: {
        workspaceId,
        title: input.title,
        body: input.body,
        isActive: input.isActive,
        position: nextPosition(last._max.position),
        categories: { create: input.categoryKeys.map((categoryKey) => ({ categoryKey })) },
      },
      include: WITH_LINKS,
    });
    await audit(tx, session, 'knowledge_article.created', a);
    return a;
  });
}

/** Changes the given fields; a given category list replaces the article's links. */
export async function updateArticle(
  db: Db,
  session: Session,
  id: string,
  input: UpdateArticleInput,
): Promise<Row> {
  const workspaceId = session.workspaceId;
  return db.$transaction(async (tx) => {
    await lockWorkspace(tx, workspaceId);
    const own = await tx.knowledgeArticle.count({ where: { id, workspaceId } });
    if (!own) throw new NotFoundError('Article');
    const { categoryKeys, ...fields } = input;
    if (categoryKeys) {
      await assertOwnCategories(tx, workspaceId, categoryKeys);
      await tx.knowledgeArticleCategory.deleteMany({ where: { articleId: id } });
      await tx.knowledgeArticleCategory.createMany({
        data: categoryKeys.map((categoryKey) => ({ workspaceId, articleId: id, categoryKey })),
      });
    }
    const a = await tx.knowledgeArticle.update({
      where: { id },
      data: fields,
      include: WITH_LINKS,
    });
    await audit(tx, session, 'knowledge_article.updated', a);
    return a;
  });
}

export async function reorderArticles(db: Db, session: Session, ids: string[]): Promise<Row[]> {
  const workspaceId = session.workspaceId;
  await db.$transaction(async (tx) => {
    await lockWorkspace(tx, workspaceId);
    const rows = await tx.knowledgeArticle.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    assertSameRows(
      rows.map((r) => r.id),
      ids,
    );
    for (const [position, id] of ids.entries())
      await tx.knowledgeArticle.update({ where: { id }, data: { position } });
    await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: session.userId,
        entityType: 'knowledge_article',
        entityId: workspaceId,
        action: 'knowledge_article.reordered',
        after: { ids },
      },
    });
  });
  return listArticles(db, session);
}
