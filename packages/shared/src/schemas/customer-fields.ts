import { z } from 'zod';
import { cleanText } from '../sanitize.js';
import { SourcePathSchema } from './data-sources.js';

/**
 * The workspace's customer-data schema: which facts its product sends, what each one means
 * (for the assistant) and whether the customer may see it. BookLeaf's fact ids are one
 * workspace's rows, seeded from `fact-ids.ts`.
 */
export const CUSTOMER_FIELD_TYPES = ['MONEY', 'DATE', 'TEXT', 'STATUS', 'NUMBER'] as const;
export type CustomerFieldType = (typeof CUSTOMER_FIELD_TYPES)[number];

/** `account.total_pending`, `item.{id}.status`: dotted segments, `{id}` marks a per-item fact. */
export const CustomerFieldKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(
    /^[a-z][a-z0-9_]*(?:\.(?:[a-z0-9_]+|\{id\}))*$/,
    'Use lowercase dotted keys, e.g. account.balance or item.{id}.status',
  );

const statusCode = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Z0-9_]+$/, 'Status codes are UPPER_SNAKE_CASE');

export const CustomerFieldInputSchema = z
  .object({
    key: CustomerFieldKeySchema,
    label: cleanText(1, 80),
    type: z.enum(CUSTOMER_FIELD_TYPES),
    description: cleanText(0, 500).optional().default(''),
    allowedValues: z.array(statusCode).max(30).optional().default([]),
    visibleToCustomer: z.boolean().optional().default(true),
    position: z.int().min(0).max(10_000).optional().default(0),
    /**
     * U-9 mapping: where a MAPPED data source holds this value. Per-item fields (`{id}` in the
     * key) leave `sourceId` empty: their path is read inside each element of the item list.
     */
    sourceId: z.uuid().nullable().optional().default(null),
    path: SourcePathSchema.nullable().optional().default(null),
  })
  .refine((f) => f.type !== 'STATUS' || f.allowedValues.length > 0, {
    path: ['allowedValues'],
    message: 'A STATUS field lists the codes the product may send',
  })
  .refine((f) => !(f.key.includes('{id}') && f.sourceId), {
    path: ['sourceId'],
    message: 'A per-item field is read from the item list; leave the source empty',
  })
  .refine((f) => f.key.includes('{id}') || (f.sourceId === null) === (f.path === null), {
    path: ['path'],
    message: 'Pick both a data source and a path, or neither',
  });
export type CustomerFieldInput = z.input<typeof CustomerFieldInputSchema>;

export const CustomerFieldSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  label: z.string(),
  type: z.enum(CUSTOMER_FIELD_TYPES),
  description: z.string(),
  allowedValues: z.array(z.string()),
  visibleToCustomer: z.boolean(),
  position: z.int(),
  sourceId: z.string().nullable(),
  path: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});
export type CustomerField = z.infer<typeof CustomerFieldSchema>;

export const CustomerFieldListSchema = z.object({ items: z.array(CustomerFieldSchema) });
