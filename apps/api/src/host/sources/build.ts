import { HostCustomerSchema, type HostCustomer, type HostItem } from '@bookleaf/shared';
import { CustomerNotFoundError, HostUnavailableError } from '../errors.js';
import { accountFields, join, mappedItems } from './build-fields.js';
import { readPath } from './path.js';
import type { MappingSpec, SourceResult, SourceSpec, Unavailable } from './types.js';

export interface BuildInput {
  externalId: string;
  sources: SourceSpec[];
  mapping: MappingSpec;
  /** Each called source's answer, by source id. */
  results: Map<string, SourceResult>;
}

const failed = (res: SourceResult | undefined, name: string): never => {
  if (res && !res.ok && res.status === 404) throw new CustomerNotFoundError();
  throw new HostUnavailableError(`${name}: ${res && !res.ok ? res.reason : 'not called'}`);
};

/** The fixed-shape answer, checked exactly as the single endpoint always was. */
function contractBase(src: SourceSpec, res: SourceResult | undefined, externalId: string) {
  if (!res?.ok) return failed(res, src.name);
  const parsed = HostCustomerSchema.safeParse(res.json);
  if (!parsed.success) throw new HostUnavailableError('response does not match the contract');
  if (parsed.data.id !== externalId) throw new HostUnavailableError('response is for another id');
  return parsed.data;
}

/** Name and email from mapped sources. Without them there is no record (as before U-9). */
function identity(input: BuildInput, sources: Map<string, SourceSpec>): HostCustomer {
  const read = (key: 'name' | 'email'): string => {
    const ref = input.mapping.record[key];
    const src = ref ? sources.get(ref.sourceId) : undefined;
    if (!ref || !src) throw new HostUnavailableError(`the customer ${key} is not mapped yet`);
    const res = input.results.get(src.id);
    if (!res?.ok) return failed(res, src.name);
    const value = readPath(res.json, ref.path);
    if (typeof value !== 'string' || !value.trim())
      throw new HostUnavailableError(`${src.name}: no ${key} at ${ref.path}`);
    return value.trim().slice(0, key === 'name' ? 80 : 254);
  };
  return {
    id: input.externalId,
    name: read('name'),
    email: read('email'),
    items: [],
    facts: [],
    details: [],
  };
}

/** Mapped items join the fixed-shape items with the same id; new ones are added. */
function mergeItems(base: HostItem[], mapped: HostItem[]): HostItem[] {
  const byId = new Map(mapped.map((i) => [i.id, i]));
  const merged = base.map((item) => {
    const extra = byId.get(item.id);
    if (!extra) return item;
    byId.delete(item.id);
    return {
      ...item,
      facts: [...item.facts, ...extra.facts],
      details: [...item.details, ...extra.details],
    };
  });
  return [...merged, ...byId.values()];
}

/**
 * U-9: one customer record from every source's answer. A CONTRACT source gives the whole record;
 * mapped values are added on top. Only the source holding the record itself (the fixed-shape one,
 * or the one with name and email) is required: any other failing source just marks its fields
 * unavailable. Throws CustomerNotFoundError / HostUnavailableError like the single endpoint did.
 */
export function buildCustomer(input: BuildInput): {
  customer: HostCustomer;
  unavailable: Unavailable[];
} {
  const sources = new Map(input.sources.map((s) => [s.id, s]));
  const contract = input.sources.find((s) => s.format === 'CONTRACT');
  const base = contract
    ? contractBase(contract, input.results.get(contract.id), input.externalId)
    : identity(input, sources);
  const account = accountFields(input.mapping.fields, input.results, sources, input.externalId);
  const items = mappedItems(input.mapping, input.results, sources);
  const added = items ? join(account, items.built) : account;
  const parsed = HostCustomerSchema.safeParse({
    ...base,
    facts: [...base.facts, ...added.facts].slice(0, 200),
    details: [...base.details, ...added.details].slice(0, 30),
    items: (items ? mergeItems(base.items, items.items) : base.items).slice(0, 100),
  });
  if (!parsed.success)
    throw new HostUnavailableError('the mapped record does not fit the customer shape');
  return { customer: parsed.data, unavailable: added.unavailable };
}
