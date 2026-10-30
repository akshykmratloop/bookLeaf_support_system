import type { Article, Category, CategoryOption } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import type { Session } from '../auth/session.js';
import {
  createArticle,
  listArticles,
  reorderArticles,
  toArticleDto,
  updateArticle,
  type CreateArticleInput,
  type UpdateArticleInput,
} from './articles.js';
import {
  categoryOptions,
  createCategory,
  listCategories,
  reorderCategories,
  toCategoryDto,
  updateCategory,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from './categories.js';

type Items<T> = Promise<{ items: T[] }>;

/** A workspace's ticket categories and knowledge base (S.9), always scoped to the session. */
export function createCategoryService(deps: { db: Db }) {
  const { db } = deps;
  return {
    options: async (s: Session): Items<CategoryOption> => ({
      items: await categoryOptions(db, s),
    }),
    categories: {
      list: async (s: Session): Items<Category> => ({
        items: (await listCategories(db, s)).map(toCategoryDto),
      }),
      create: async (s: Session, input: CreateCategoryInput) =>
        toCategoryDto(await createCategory(db, s, input)),
      update: async (s: Session, id: string, input: UpdateCategoryInput) =>
        toCategoryDto(await updateCategory(db, s, id, input)),
      reorder: async (s: Session, ids: string[]): Items<Category> => ({
        items: (await reorderCategories(db, s, ids)).map(toCategoryDto),
      }),
    },
    articles: {
      list: async (s: Session): Items<Article> => ({
        items: (await listArticles(db, s)).map(toArticleDto),
      }),
      create: async (s: Session, input: CreateArticleInput) =>
        toArticleDto(await createArticle(db, s, input)),
      update: async (s: Session, id: string, input: UpdateArticleInput) =>
        toArticleDto(await updateArticle(db, s, id, input)),
      reorder: async (s: Session, ids: string[]): Items<Article> => ({
        items: (await reorderArticles(db, s, ids)).map(toArticleDto),
      }),
    },
  };
}

export type CategoryService = ReturnType<typeof createCategoryService>;
