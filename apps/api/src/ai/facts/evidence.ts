import { formatDate, formatInr, type Fact, type FactSource } from '@bookleaf/shared';

/** Small constructors so every fact carries a typed value, display text and source. */
export function recordSource(table: string, recordId: string, field: string): FactSource {
  return { kind: 'RECORD', table, recordId, field };
}

export function derived(rule: string, inputs: string[], assumptions: string[] = []): FactSource {
  return { kind: 'DERIVED', rule, inputs, assumptions };
}

export function moneyFact(id: string, label: string, paise: number, source: FactSource): Fact {
  return { id, label, type: 'MONEY', value: paise, display: formatInr(paise), source };
}

export function dateFact(id: string, label: string, iso: string, source: FactSource): Fact {
  return { id, label, type: 'DATE', value: iso, display: formatDate(iso), source };
}

export function countFact(id: string, label: string, n: number, source: FactSource): Fact {
  return { id, label, type: 'COUNT', value: n, display: String(n), source };
}

export function textFact(
  id: string,
  label: string,
  text: string,
  source: FactSource,
  type: Fact['type'] = 'TEXT',
): Fact {
  return { id, label, type, value: text, display: text, source };
}

/** A fact BookLeaf does not have. Drafts must ask an admin to confirm instead of guessing. */
export function unknownFact(id: string, label: string, reason: string): Fact {
  return { id, label, type: 'UNKNOWN', value: null, display: 'Unknown', source: { kind: 'MISSING', reason } };
}
