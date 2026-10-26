import { z } from 'zod';

export const FACT_TYPES = [
  'MONEY',
  'DATE',
  'COUNT',
  'DURATION',
  'PERCENT',
  'STATUS',
  'TEXT',
  'UNKNOWN',
] as const;

/** Where a fact came from. Shown to admins as evidence next to every draft. */
export const FactSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('RECORD'),
    table: z.string(),
    recordId: z.string(),
    field: z.string(),
  }),
  z.object({ kind: z.literal('KB'), section: z.string(), rule: z.string() }),
  z.object({
    kind: z.literal('DERIVED'),
    rule: z.string(),
    inputs: z.array(z.string()),
    assumptions: z.array(z.string()),
  }),
  z.object({ kind: z.literal('MISSING'), reason: z.string() }),
]);
export type FactSource = z.infer<typeof FactSourceSchema>;

export const FactSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(FACT_TYPES),
  /** MONEY in paise, COUNT/PERCENT numbers, DATE as YYYY-MM-DD, DURATION as display text. */
  value: z.union([z.number(), z.string(), z.null()]),
  display: z.string(),
  source: FactSourceSchema,
});
export type Fact = z.infer<typeof FactSchema>;
