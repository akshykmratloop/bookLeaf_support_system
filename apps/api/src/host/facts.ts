import type { Fact, HostCustomer } from '@bookleaf/shared';
import { CustomerNotFoundError, HostUnavailableError } from './errors.js';
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

/**
 * The customer, or null while the host is unavailable or no longer knows this signed-in customer
 * (deleted or renamed at the host): screens then say the records cannot be seen, instead of
 * failing. Other errors still propagate.
 */
export async function customerOrNull(
  records: HostRecords,
  externalId: string,
  workspaceId?: string,
) {
  try {
    return await records.customer(externalId, workspaceId);
  } catch (err) {
    if (err instanceof HostUnavailableError || err instanceof CustomerNotFoundError) return null;
    throw err;
  }
}
