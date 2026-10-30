import { z } from 'zod';
import { HostCustomerSchema } from './host.js';

/**
 * U-9: where a workspace's customer data comes from. One to five data sources, each a GET URL
 * template with `{id}` and/or `{email}` (URL-encoded when filled in). A CONTRACT source answers in
 * the fixed customer shape (docs/integration.md); a MAPPED source answers in any JSON, and the
 * Customer data page maps paths in it to the record (name, email, item list) and to each field.
 */
export const MAX_DATA_SOURCES = 5;
export const DATA_SOURCE_FORMATS = ['CONTRACT', 'MAPPED'] as const;
export type DataSourceFormat = (typeof DATA_SOURCE_FORMATS)[number];

const PLACEHOLDER = /\{([^{}]*)\}/g;
const ALLOWED_PLACEHOLDERS = new Set(['id', 'email']);
/** Scheme and host come before any placeholder, so a template can never pick another host. */
const FIXED_ORIGIN = /^https?:\/\/[^/?#{}\s]+[/?]/i;

/** The placeholders a template uses, e.g. ['id'] for `https://x.com/customers/{id}`. */
export const templatePlaceholders = (template: string): string[] =>
  [...template.matchAll(PLACEHOLDER)].map((m) => m[1] ?? '');

export const UrlTemplateSchema = z
  .string()
  .trim()
  .min(10)
  .max(2048)
  .refine((t) => FIXED_ORIGIN.test(t), {
    message: 'Start with http(s)://host/ — placeholders may only appear in the path or query',
  })
  .refine((t) => templatePlaceholders(t).every((p) => ALLOWED_PLACEHOLDERS.has(p)), {
    message: 'Only {id} and {email} placeholders are supported',
  })
  .refine((t) => templatePlaceholders(t).length > 0, {
    message: 'Use {id} or {email} so each customer gets their own data',
  });

/** Request headers a source may not take over (the key goes in a header of its own). */
const RESERVED_HEADERS = new Set([
  'host',
  'cookie',
  'content-length',
  'content-type',
  'connection',
  'transfer-encoding',
  'accept',
]);

/** Null = `Authorization: Bearer <key>`; otherwise the key is sent as `<header>: <key>`. */
export const AuthHeaderSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/, 'Letters, digits and dashes only, e.g. X-Api-Key')
  .refine((h) => !RESERVED_HEADERS.has(h.toLowerCase()), { message: 'This header is reserved' });

/** `data.user.name`, `books.0.title`; `$` is the whole response. */
export const SourcePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^(\$|[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+){0,11})$/, 'Dotted path, e.g. data.user.name');

const SourceNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[\p{L}\p{N} ._-]+$/u, 'Letters, digits, spaces, . _ -');

export const DataSourceInputSchema = z
  .object({
    /** Omit for a new source; an existing id keeps its field mappings. */
    id: z.uuid().optional(),
    name: SourceNameSchema,
    urlTemplate: UrlTemplateSchema,
    format: z.enum(DATA_SOURCE_FORMATS).default('MAPPED'),
    authHeader: AuthHeaderSchema.nullable().default(null),
    timeoutMs: z.int().min(200).max(10_000).default(3000),
    cacheSeconds: z.int().min(0).max(600).default(60),
  })
  .strict();
export type DataSourceInput = z.input<typeof DataSourceInputSchema>;

export const DataSourceListSchema = z
  .array(DataSourceInputSchema)
  .min(1)
  .max(MAX_DATA_SOURCES)
  .refine((list) => new Set(list.map((s) => s.name.toLowerCase())).size === list.length, {
    message: 'Each data source needs its own name',
  })
  .refine((list) => list.filter((s) => s.format === 'CONTRACT').length <= 1, {
    message: 'Only one data source can answer in the full customer format',
  });

export const DataSourceSchema = z.object({
  /** A uuid, or `env` for the default workspace's source while it runs on server settings. */
  id: z.string(),
  name: z.string(),
  urlTemplate: z.string(),
  format: z.enum(DATA_SOURCE_FORMATS),
  authHeader: z.string().nullable(),
  timeoutMs: z.int(),
  cacheSeconds: z.int(),
});
export type DataSource = z.infer<typeof DataSourceSchema>;

/** One value read from one source: which source, and where in its JSON. */
export const SourceRefSchema = z.object({ sourceId: z.uuid(), path: SourcePathSchema }).strict();
export type SourceRef = z.infer<typeof SourceRefSchema>;

/** Where the customer's name, email and item list (e.g. books) come from in mapped sources. */
export const RecordMappingSchema = z
  .object({
    name: SourceRefSchema.nullable().default(null),
    email: SourceRefSchema.nullable().default(null),
    /** `path` points at an array; `idPath` / `titlePath` are read inside each element. */
    items: SourceRefSchema.extend({
      idPath: SourcePathSchema,
      titlePath: SourcePathSchema.nullable().default(null),
    })
      .strict()
      .nullable()
      .default(null),
  })
  .strict();
export type RecordMapping = z.output<typeof RecordMappingSchema>;
export type RecordMappingInput = z.input<typeof RecordMappingSchema>;

export const SaveRecordMappingRequestSchema = z
  .object({ version: z.int().min(0), mapping: RecordMappingSchema })
  .strict();
export type SaveRecordMappingRequest = z.input<typeof SaveRecordMappingRequestSchema>;

/** What one source answered during a test: the raw response, so admins can pick paths. */
export const SourceProbeSchema = z.object({
  sourceId: z.string(),
  name: z.string(),
  ok: z.boolean(),
  /** HTTP status, or null when there was no answer (timeout, refused address). */
  status: z.int().nullable(),
  detail: z.string(),
  durationMs: z.int(),
  /** Pretty-printed JSON, cut at 20,000 characters; null when nothing readable came back. */
  raw: z.string().nullable(),
});
export type SourceProbe = z.infer<typeof SourceProbeSchema>;

/** The merged record as support would see it, with the fields that could not be read. */
export const MappedPreviewSchema = z.object({
  customer: HostCustomerSchema.nullable(),
  unavailable: z.array(z.object({ key: z.string(), reason: z.string() })),
});
export type MappedPreview = z.infer<typeof MappedPreviewSchema>;
