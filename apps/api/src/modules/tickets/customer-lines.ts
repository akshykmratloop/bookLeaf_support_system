import type { CustomerLine, Fact, HostDetail } from '@bookleaf/shared';
import { itemLabelOf } from '../../host/item-label.js';

/** The part of a workspace customer data field the Customer panel needs. */
export interface FieldLabel {
  key: string;
  label: string;
  position: number;
}

const ID_MARK = '{id}';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The fact id a field stands for: the key itself, or with `{id}` filled in for one item. */
function fieldMatches(field: FieldLabel, factId: string, itemId: string | null): boolean {
  if (!field.key.includes(ID_MARK)) return itemId === null && field.key === factId;
  if (itemId === null) return false;
  const pattern = field.key.split(ID_MARK).map(escape).join(escape(itemId));
  return new RegExp(`^${pattern}$`).test(factId);
}

/** A line repeats an earlier one: same name, or the same value under a longer/shorter name. */
function repeats(shown: readonly CustomerLine[], line: CustomerLine): boolean {
  const label = norm(line.label);
  return shown.some((s) => {
    const other = norm(s.label);
    if (other === label) return true;
    const sameValue = norm(s.display) === norm(line.display);
    return sameValue && (other.includes(label) || label.includes(other));
  });
}

/** Without any fields, the record's own facts (not policy text, not missing values). */
const fromRecord = (f: Fact) => f.source.kind === 'RECORD' || f.source.kind === 'DERIVED';

function factLines(facts: readonly Fact[], fields: readonly FieldLabel[], itemId: string | null) {
  if (fields.length === 0)
    return facts.filter(fromRecord).map((f) => ({ label: f.label, display: f.display }));
  const ordered = [...fields].sort((a, b) => a.position - b.position || a.key.localeCompare(b.key));
  return ordered.flatMap((field) => {
    const fact = facts.find((f) => fieldMatches(field, f.id, itemId));
    if (!fact) return [];
    const label = itemId === null ? field.label : itemLabelOf(field.label);
    return [{ label, display: fact.display }];
  });
}

/** The product's own lines first, then the facts the fields describe, each name once. */
function merge(details: readonly HostDetail[], lines: readonly CustomerLine[]): CustomerLine[] {
  const shown: CustomerLine[] = details.map((d) => ({ label: d.label, display: d.display }));
  for (const line of lines) if (!repeats(shown, line)) shown.push(line);
  return shown;
}

/**
 * The account part of the panel. Workspace-generic: the labels and order come from the
 * workspace's customer data fields, the values from the customer record.
 */
export const accountLines = (
  details: readonly HostDetail[],
  facts: readonly Fact[],
  fields: readonly FieldLabel[],
): CustomerLine[] => merge(details, factLines(facts, fields, null));

/** One item's part (for BookLeaf: a book), matching `{id}` fields to this item's id. */
export const itemLines = (
  itemId: string,
  details: readonly HostDetail[],
  facts: readonly Fact[],
  fields: readonly FieldLabel[],
): CustomerLine[] => merge(details, factLines(facts, fields, itemId));
