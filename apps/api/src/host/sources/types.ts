import type { CustomerFieldType, DataSourceFormat, RecordMapping } from '@bookleaf/shared';

/**
 * U-9: plain settings of a workspace's data sources, as the engine needs them. Core code builds
 * these from the database (connectors module); the engine never reads the database itself.
 */
export interface SourceSpec {
  id: string;
  name: string;
  /** GET URL with `{id}` / `{email}`, filled in URL-encoded. */
  urlTemplate: string;
  /** CONTRACT: answers in the fixed customer shape. MAPPED: any JSON, read through paths. */
  format: DataSourceFormat;
  /** Null: `Authorization: Bearer <key>`; otherwise `<authHeader>: <key>`. */
  authHeader: string | null;
  timeoutMs: number;
  cacheSeconds: number;
}

/** One customer-data field and where its value is read (null source/path = not mapped). */
export interface FieldSpec {
  key: string;
  label: string;
  type: CustomerFieldType;
  allowedValues: string[];
  visibleToCustomer: boolean;
  /** Account fields only; per-item fields (`{id}` in the key) read from the item list. */
  sourceId: string | null;
  path: string | null;
}

export interface MappingSpec {
  record: RecordMapping;
  fields: FieldSpec[];
}

export interface SourcesConfig {
  sources: SourceSpec[];
  mapping: MappingSpec;
  /** The connection's API key, sent to every source. */
  apiKey: string;
  /** Re-checks each URL right before it is called (a tenant's own sources: SSRF, DNS rebinding). */
  checkUrl?: (url: URL) => Promise<void>;
  /** The email support knows for this customer, to fill `{email}` (null = none known). */
  emailOf?: (externalId: string) => Promise<string | null>;
}

/** What one source answered: its JSON, or why there is none. */
export type SourceResult =
  | { ok: true; status: number; json: unknown }
  | { ok: false; status: number | null; reason: string };

/** A field that could not be read, and why (shown on the Test panel and as a MISSING fact). */
export interface Unavailable {
  key: string;
  reason: string;
}
