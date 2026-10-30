import { RecordMappingSchema, type RecordMapping } from '@bookleaf/shared';
import type { MappingSpec } from './types.js';

export const EMPTY_RECORD_MAPPING: RecordMapping = { name: null, email: null, items: null };
export const EMPTY_MAPPING: MappingSpec = { record: EMPTY_RECORD_MAPPING, fields: [] };

/**
 * The saved record mapping (a JSON column), checked again on every read. A value that no longer
 * fits the schema (hand-edited, older shape) is treated as "not mapped" rather than trusted.
 */
export function recordMappingOf(stored: unknown): RecordMapping {
  if (stored === null || stored === undefined) return EMPTY_RECORD_MAPPING;
  const parsed = RecordMappingSchema.safeParse(stored);
  return parsed.success ? parsed.data : EMPTY_RECORD_MAPPING;
}
