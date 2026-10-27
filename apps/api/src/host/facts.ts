import type { Fact, HostCustomer } from '@bookleaf/shared';
import { HostUnavailableError } from './errors.js';
import type { HostRecords } from './types.js';

/** Used instead of the customer's facts when the host cannot answer: the assistant then says
 * it cannot see the records and offers a ticket, rather than guessing. */
export const RECORDS_UNAVAILABLE: Fact = {
  id: 'host.records_unavailable',
  label: "The author's records",
  type: 'UNKNOWN',
  value: null,
  display: 'Unknown',
  source: { kind: 'MISSING', reason: 'The product did not answer; records are unavailable' },
};

const unique = (facts: Fact[]) => [...new Map(facts.map((f) => [f.id, f])).values()];

/** Every fact about the customer: account facts first, then each item's. */
export const allFacts = (c: HostCustomer): Fact[] =>
  unique([...c.facts, ...c.items.flatMap((i) => i.facts)]);

/** Account facts plus one item's (null = an account-level question). */
export const factsFor = (c: HostCustomer, itemId: string | null): Fact[] =>
  unique([...c.facts, ...(c.items.find((i) => i.id === itemId)?.facts ?? [])]);

/** The customer, or null while the host is unavailable. Other errors still propagate. */
export async function customerOrNull(records: HostRecords, externalId: string) {
  try {
    return await records.customer(externalId);
  } catch (err) {
    if (err instanceof HostUnavailableError) return null;
    throw err;
  }
}
