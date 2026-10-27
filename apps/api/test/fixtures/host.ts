import type { HostCustomer } from '@bookleaf/shared';
import { loadAuthors, toCustomer } from '@bookleaf/host-demo';

/** The demo host's data date: tests see the same facts the running demo would send. */
export const AS_OF = new Date('2025-12-31T00:00:00Z');
const AUTHORS = loadAuthors();

/** One sample author exactly as the host contract delivers them (book ids are BK001…). */
export function sampleCustomer(externalId: string): HostCustomer {
  const account = AUTHORS.find((a) => a.record.externalId === externalId);
  if (!account) throw new Error(`No sample author ${externalId}`);
  return toCustomer(account, AS_OF);
}

export const booksOf = (c: HostCustomer) => c.items.map((i) => ({ id: i.id, title: i.title }));
