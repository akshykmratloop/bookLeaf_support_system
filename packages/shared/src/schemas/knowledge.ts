import { z } from 'zod';
import { cleanText } from '../sanitize.js';
import { CategoryKeySchema } from './categories.js';

export const ARTICLE_LIMITS = { title: 120, body: 8000, categories: 50 } as const;

const categoryKeys = z
  .array(CategoryKeySchema)
  .max(ARTICLE_LIMITS.categories)
  .refine((keys) => new Set(keys).size === keys.length, {
    message: 'Each category may appear once',
  });

const articleFields = {
  title: cleanText(1, ARTICLE_LIMITS.title),
  /** Plain text the AI reads as policy; HTML is stripped. */
  body: cleanText(1, ARTICLE_LIMITS.body),
  /** The categories whose tickets get this article in their AI drafts. */
  categoryKeys,
  isActive: z.boolean(),
};

export const CreateArticleSchema = z.object({
  ...articleFields,
  categoryKeys: categoryKeys.optional().default([]),
  isActive: articleFields.isActive.optional().default(true),
});
export type CreateArticle = z.input<typeof CreateArticleSchema>;

export const UpdateArticleSchema = z
  .object(articleFields)
  .partial()
  .refine((v) => Object.values(v).some((f) => f !== undefined), {
    message: 'Change at least one field',
  });
export type UpdateArticle = z.input<typeof UpdateArticleSchema>;

export const ArticleSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  categoryKeys: z.array(z.string()),
  position: z.int(),
  isActive: z.boolean(),
  updatedAt: z.iso.datetime(),
});
export type Article = z.infer<typeof ArticleSchema>;
export const ArticleListSchema = z.object({ items: z.array(ArticleSchema) });
