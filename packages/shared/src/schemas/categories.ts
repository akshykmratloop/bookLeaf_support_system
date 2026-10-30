import { z } from 'zod';
import { PRIORITIES } from '../enums.js';
import { cleanText } from '../sanitize.js';

/**
 * A workspace category's key: UPPER_SNAKE_CASE, 2–40 characters (e.g. ROYALTY_PAYMENTS). Fixed
 * once created, because tickets and knowledge articles link to the category by it.
 */
export const CategoryKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Use UPPER_SNAKE_CASE, e.g. BILLING_QUESTIONS');
export type CategoryKey = z.infer<typeof CategoryKeySchema>;

/** First-response target in hours (up to 30 days); null = the priority's target alone. */
export const SLA_HOURS_LIMITS = { min: 1, max: 720 } as const;
export const CATEGORY_LIMITS = { label: 60, description: 500 } as const;

const categoryFields = {
  label: cleanText(1, CATEGORY_LIMITS.label),
  /** What belongs in this category, written for the AI triage. */
  description: cleanText(1, CATEGORY_LIMITS.description),
  defaultPriority: z.enum(PRIORITIES),
  slaHours: z.int().min(SLA_HOURS_LIMITS.min).max(SLA_HOURS_LIMITS.max).nullable(),
  isActive: z.boolean(),
};

export const CreateCategorySchema = z.object({
  key: CategoryKeySchema,
  ...categoryFields,
  slaHours: categoryFields.slaHours.optional().default(null),
  isActive: categoryFields.isActive.optional().default(true),
});
export type CreateCategory = z.input<typeof CreateCategorySchema>;

/** Any of the editable fields; the key never changes. */
export const UpdateCategorySchema = z
  .object(categoryFields)
  .partial()
  .refine((v) => Object.values(v).some((f) => f !== undefined), {
    message: 'Change at least one field',
  });
export type UpdateCategory = z.input<typeof UpdateCategorySchema>;

export const CategorySchema = z.object({
  id: z.uuid(),
  key: z.string(),
  label: z.string(),
  description: z.string(),
  defaultPriority: z.enum(PRIORITIES),
  slaHours: z.int().nullable(),
  position: z.int(),
  isActive: z.boolean(),
  updatedAt: z.iso.datetime(),
});
export type Category = z.infer<typeof CategorySchema>;
export const CategoryListSchema = z.object({ items: z.array(CategorySchema) });

/** What pickers and labels need: the workspace's active categories, in order. */
export const CategoryOptionSchema = z.object({ key: z.string(), label: z.string() });
export type CategoryOption = z.infer<typeof CategoryOptionSchema>;
export const CategoryOptionListSchema = z.object({ items: z.array(CategoryOptionSchema) });

/** A new display order: every id of the list, each exactly once. */
export const ReorderSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Each id may appear once' }),
});
export type Reorder = z.infer<typeof ReorderSchema>;
