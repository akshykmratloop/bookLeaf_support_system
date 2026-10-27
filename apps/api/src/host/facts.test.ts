import { describe, expect, it } from 'vitest';
import { CustomerNotFoundError, HostUnavailableError } from './errors.js';
import { customerOrNull } from './facts.js';
import type { HostRecords } from './types.js';

const failing = (err: Error): HostRecords => ({
  customer: async () => {
    throw err;
  },
});

describe('customerOrNull', () => {
  it('is null when the host is down, so screens show "records unavailable"', async () => {
    await expect(
      customerOrNull(failing(new HostUnavailableError('down')), 'C1'),
    ).resolves.toBeNull();
  });

  it('is null when the host no longer knows a signed-in customer (deleted or renamed id)', async () => {
    await expect(customerOrNull(failing(new CustomerNotFoundError()), 'C1')).resolves.toBeNull();
  });

  it('still throws anything unexpected', async () => {
    await expect(customerOrNull(failing(new TypeError('bug')), 'C1')).rejects.toBeInstanceOf(
      TypeError,
    );
  });
});
