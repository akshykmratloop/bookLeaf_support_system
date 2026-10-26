import { z } from 'zod';

/** RFC 7807 problem details returned for every error response. */
export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.int(),
  code: z.string(),
  detail: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

export const IdParamSchema = z.object({ id: z.uuid() });

export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
