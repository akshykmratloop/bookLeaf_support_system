import { z } from 'zod';
import { DRAFT_SOURCES } from '../enums.js';
import { FactSchema } from './facts.js';

export const CHECK_SEVERITIES = ['BLOCK', 'WARN'] as const;

export const CheckIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(CHECK_SEVERITIES),
  message: z.string(),
  excerpt: z.string().optional(),
  /** Placeholders can never be overridden; other BLOCK issues can, with a written reason. */
  overridable: z.boolean(),
});
export type CheckIssue = z.infer<typeof CheckIssueSchema>;

export const CheckResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(CheckIssueSchema),
  placeholders: z.array(z.string()),
});
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const DraftSchema = z.object({
  id: z.uuid(),
  generation: z.int(),
  source: z.enum(DRAFT_SOURCES),
  body: z.string(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  facts: z.array(FactSchema),
  check: CheckResultSchema,
  createdAt: z.iso.datetime(),
});
export type Draft = z.infer<typeof DraftSchema>;

/** Draft endpoint returns null while generation is still running. */
export const DraftResponseSchema = z.object({
  draft: DraftSchema.nullable(),
  pending: z.boolean(),
});

export const CheckRequestSchema = z.object({ body: z.string().max(8000) });
