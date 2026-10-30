import type { Fact, HostDetail, HostItem } from '@bookleaf/shared';
import { readPath } from './path.js';
import type { FieldSpec, MappingSpec, SourceResult, SourceSpec, Unavailable } from './types.js';
import { factTypeOf, toFactValue } from './values.js';

/** What a group of mapped fields adds to the record. */
export interface Built {
  facts: Fact[];
  details: HostDetail[];
  unavailable: Unavailable[];
}

type Lookup = { ok: true; raw: unknown } | { ok: false; reason: string };
interface Where {
  table: string;
  recordId: string;
  factId: string;
}

const UNAVAILABLE = 'Unavailable';
const MAX_ITEMS = 100;
/** Same rule as host ids in the fixed shape: letters, digits and `. _ @ : -`, never "." or "..". */
const ITEM_ID = /^(?!\.{1,2}$)[\w.@:-]{1,100}$/;

export const emptyBuilt = (): Built => ({ facts: [], details: [], unavailable: [] });
export const isItemField = (f: FieldSpec) => f.key.includes('{id}');

export const lookupIn = (res: SourceResult | undefined, path: string): Lookup => {
  if (!res) return { ok: false, reason: 'not called' };
  return res.ok ? { ok: true, raw: readPath(res.json, path) } : { ok: false, reason: res.reason };
};

/** One field's value as a fact (and a detail the customer may see), or marked unavailable. */
export function readField(field: FieldSpec, lookup: Lookup, where: Where): Built {
  const value = lookup.ok ? toFactValue(field.type, lookup.raw, field.allowedValues) : lookup;
  const show = (display: string) =>
    field.visibleToCustomer ? [{ label: field.label, display: display.slice(0, 300) }] : [];
  if (value.ok) {
    const source = {
      kind: 'RECORD' as const,
      table: where.table,
      recordId: where.recordId,
      field: field.path ?? '',
    };
    const fact: Fact = {
      id: where.factId,
      label: field.label,
      type: factTypeOf(field.type),
      value: value.value,
      display: value.display,
      source,
    };
    return { facts: [fact], details: show(value.display), unavailable: [] };
  }
  const reason = `${where.table}: ${value.reason}`;
  const fact: Fact = {
    id: where.factId,
    label: field.label,
    type: factTypeOf(field.type),
    value: null,
    display: UNAVAILABLE,
    source: { kind: 'MISSING', reason },
  };
  return {
    facts: [fact],
    details: show(UNAVAILABLE),
    unavailable: [{ key: where.factId, reason }],
  };
}

export const join = (a: Built, b: Built): Built => ({
  facts: [...a.facts, ...b.facts],
  details: [...a.details, ...b.details],
  unavailable: [...a.unavailable, ...b.unavailable],
});

/** Account-level fields (no `{id}`), each read from its own source. Stale mappings are skipped. */
export function accountFields(
  fields: FieldSpec[],
  results: Map<string, SourceResult>,
  sources: Map<string, SourceSpec>,
  externalId: string,
): Built {
  return fields.reduce((acc, field) => {
    const src = field.sourceId ? sources.get(field.sourceId) : undefined;
    if (isItemField(field) || !src || !field.path) return acc;
    const where = { table: src.name, recordId: externalId, factId: field.key };
    return join(acc, readField(field, lookupIn(results.get(src.id), field.path), where));
  }, emptyBuilt());
}

function itemOf(
  el: unknown,
  m: NonNullable<MappingSpec['record']['items']>,
  fields: FieldSpec[],
  table: string,
) {
  const rawId = readPath(el, m.idPath);
  const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).trim() : '';
  if (!ITEM_ID.test(id)) return null;
  const rawTitle = m.titlePath ? readPath(el, m.titlePath) : undefined;
  const title =
    typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim().slice(0, 300) : id;
  const built = fields.reduce((acc, field) => {
    const where = { table, recordId: id, factId: field.key.replaceAll('{id}', id) };
    return join(acc, readField(field, { ok: true, raw: readPath(el, field.path ?? '$') }, where));
  }, emptyBuilt());
  const item: HostItem = {
    id,
    title,
    facts: built.facts.slice(0, 200),
    details: built.details.slice(0, 30),
  };
  return { item, unavailable: built.unavailable };
}

const itemsUnavailable = (reason: string): Fact => ({
  id: 'host.items_unavailable',
  label: 'The customer’s items',
  type: 'UNKNOWN',
  value: null,
  display: 'Unknown',
  source: { kind: 'MISSING', reason },
});

/** The item list (e.g. books) from its source, with each item's per-item fields. */
export function mappedItems(
  mapping: MappingSpec,
  results: Map<string, SourceResult>,
  sources: Map<string, SourceSpec>,
): { items: HostItem[]; built: Built } | null {
  const m = mapping.record.items;
  const src = m ? sources.get(m.sourceId) : undefined;
  if (!m || !src) return null;
  const res = results.get(src.id);
  const list = res?.ok ? readPath(res.json, m.path) : undefined;
  if (!Array.isArray(list)) {
    const reason = `${src.name}: ${res && !res.ok ? res.reason : 'no list at this path'}`;
    return {
      items: [],
      built: {
        facts: [itemsUnavailable(reason)],
        details: [],
        unavailable: [{ key: 'items', reason }],
      },
    };
  }
  const fields = mapping.fields.filter((f) => isItemField(f) && f.path);
  const read = list.slice(0, MAX_ITEMS).map((el) => itemOf(el, m, fields, src.name));
  const found = read.filter((r) => r !== null);
  return {
    items: found.map((r) => r.item),
    built: { ...emptyBuilt(), unavailable: found.flatMap((r) => r.unavailable) },
  };
}
