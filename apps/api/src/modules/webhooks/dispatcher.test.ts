import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../../platform/db.js';
import { createWebhookDispatcher } from './dispatcher.js';

/** A database that fails the test if the dispatcher touches it. */
const untouchedDb = new Proxy(
  {},
  {
    get: (_t, prop) => {
      throw new Error(`dispatcher used db.${String(prop)} without a master key`);
    },
  },
) as Db;

describe('the webhook dispatcher without a master key', () => {
  it('skips the batch (no claim, no attempt burnt) and says so once', async () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    const dispatcher = createWebhookDispatcher(
      {
        db: untouchedDb,
        clock: {
          now: () => new Date('2026-11-01T00:00:00Z'),
          dataAsOf: () => new Date('2025-12-31'),
        },
        envelope: null,
        ssrf: { requireHttps: true, allowPrivateHosts: false },
        log,
      },
      { pollMs: 10 },
    );
    expect(await dispatcher.runOnce()).toBe(0);
    expect(await dispatcher.runOnce()).toBe(0);
    expect(log.error).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith(
      {},
      'webhooks are not sent: SECRETS_MASTER_KEY is not set, so signing secrets cannot be read',
    );
  });
});
