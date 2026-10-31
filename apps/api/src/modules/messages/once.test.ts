import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { writeOnce } from './once.js';

const uniqueOn = (target: string[] | null) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });

const failWith = (err: unknown) => async () => {
  throw err;
};
const replay = (found: boolean) => async () => found;

describe('writeOnce', () => {
  it('treats a clash on the Idempotency-Key column as the replay it is', async () => {
    const clash = uniqueOn(['ticket_id', 'client_request_id']);
    await expect(writeOnce(failWith(clash), replay(false))).resolves.toBeUndefined();
  });

  it('rethrows a clash on any other unique key, even if a row with the key exists', async () => {
    const other = uniqueOn(['ticket_id', 'kind', 'generation']);
    await expect(writeOnce(failWith(other), replay(true))).rejects.toBe(other);
  });

  it('when Prisma cannot name the columns, the row with this key decides', async () => {
    await expect(writeOnce(failWith(uniqueOn(null)), replay(true))).resolves.toBeUndefined();
    const unknown = uniqueOn(null);
    await expect(writeOnce(failWith(unknown), replay(false))).rejects.toBe(unknown);
  });

  it('rethrows other errors', async () => {
    const boom = new Error('boom');
    await expect(writeOnce(failWith(boom), replay(true))).rejects.toBe(boom);
  });
});
