import type { HostCustomer } from '@bookleaf/shared';
import { CustomerNotFoundError, HostUnavailableError } from '../errors.js';
import type { HostRecords } from '../types.js';

/** In-memory host for unit tests: knows the given customers; `down()` simulates an outage. */
export function fakeHostRecords(customers: HostCustomer[]) {
  let isDown = false;
  const records: HostRecords = {
    async customer(externalId) {
      if (isDown) throw new HostUnavailableError('fake host is down');
      const found = customers.find((c) => c.id === externalId);
      if (!found) throw new CustomerNotFoundError();
      return found;
    },
  };
  return { records, down: () => (isDown = true), up: () => (isDown = false) };
}
