import { useQuery } from '@tanstack/react-query';
import type {
  Article,
  Category,
  CategoryOption,
  CreateArticle,
  CreateCategory,
  UpdateArticle,
  UpdateCategory,
} from '@bookleaf/shared';
import { api } from './api';

export const categoryKeys = {
  options: ['categories', 'options'] as const,
  all: ['workspace', 'categories'] as const,
  articles: ['workspace', 'knowledge'] as const,
};

/** The workspace's active categories (issue types, filters), for staff and authors alike. */
export const useCategoryOptions = () =>
  useQuery({
    queryKey: categoryKeys.options,
    queryFn: () => api<{ items: CategoryOption[] }>('/categories').then((r) => r.items),
    staleTime: 60_000,
  });

/** A category's label from the options; its key when it is not active any more. */
export const labelFor = (options: readonly CategoryOption[] | undefined, key: string | null) =>
  key ? (options?.find((o) => o.key === key)?.label ?? key) : '';

/** The active options plus the current value, so a deactivated category still shows. */
export function optionsWith(
  options: readonly CategoryOption[] | undefined,
  key: string | null,
  label: string | null,
): CategoryOption[] {
  const list = [...(options ?? [])];
  if (key && !list.some((o) => o.key === key)) list.push({ key, label: label ?? key });
  return list;
}

export const useCategories = () =>
  useQuery({
    queryKey: categoryKeys.all,
    queryFn: () => api<{ items: Category[] }>('/workspace/categories').then((r) => r.items),
  });

export const useArticles = () =>
  useQuery({
    queryKey: categoryKeys.articles,
    queryFn: () => api<{ items: Article[] }>('/workspace/knowledge').then((r) => r.items),
  });

export const createCategory = (input: CreateCategory) =>
  api<Category>('/workspace/categories', { method: 'POST', body: input });

export const updateCategory = (id: string, input: UpdateCategory) =>
  api<Category>(`/workspace/categories/${id}`, { method: 'PATCH', body: input });

export const reorderCategories = (ids: string[]) =>
  api<{ items: Category[] }>('/workspace/categories/order', { method: 'PUT', body: { ids } });

export const createArticle = (input: CreateArticle) =>
  api<Article>('/workspace/knowledge', { method: 'POST', body: input });

export const updateArticle = (id: string, input: UpdateArticle) =>
  api<Article>(`/workspace/knowledge/${id}`, { method: 'PATCH', body: input });

export const reorderArticles = (ids: string[]) =>
  api<{ items: Article[] }>('/workspace/knowledge/order', { method: 'PUT', body: { ids } });

/** The list with one item moved up (-1) or down (+1); unchanged at either end. */
export function moved<T>(items: readonly T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(index, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** A key suggested from a label: "Billing & Refunds" → BILLING_REFUNDS. */
export function keyFromLabel(label: string): string {
  return label
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^[^A-Z]+|_+$/g, '')
    .slice(0, 40);
}
