import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { recordWidgetLoad } from '../src/modules/onboarding/signals.js';
import { verifyApiKey } from '../src/modules/workspaces/api-keys.js';
import {
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_SLUG,
} from '../src/modules/workspaces/constants.js';
import type { Clock } from '../src/platform/clock.js';
import { createDb, type Db } from '../src/platform/db.js';

/** Usage stamps written on hot paths are throttled to one write a minute. */
let db: Db;
const T0 = Date.parse('2031-01-01T00:00:00Z');
const at = (ms: number): Clock => ({
  now: () => new Date(T0 + ms),
  dataAsOf: () => new Date(T0),
});

beforeAll(() => {
  db = createDb(inject('databaseAdminUrl'));
});
afterAll(() => db.$disconnect());

describe('API key "last used"', () => {
  it('is written at most once a minute per key', async () => {
    const plain = `blsk_test_${randomBytes(16).toString('base64url')}`;
    const key = await db.workspaceApiKey.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        name: 'usage stamp test',
        prefix: 'blsk_test',
        keyHash: createHash('sha256').update(plain).digest('hex'),
      },
    });
    const lastUsed = async () =>
      (await db.workspaceApiKey.findUniqueOrThrow({ where: { id: key.id } })).lastUsedAt?.getTime();
    try {
      expect(await verifyApiKey({ db, clock: at(0) }, plain)).not.toBeNull();
      expect(await lastUsed()).toBe(T0);
      expect(await verifyApiKey({ db, clock: at(30_000) }, plain)).not.toBeNull();
      expect(await lastUsed()).toBe(T0);
      await verifyApiKey({ db, clock: at(61_000) }, plain);
      expect(await lastUsed()).toBe(T0 + 61_000);
    } finally {
      await db.workspaceApiKey.delete({ where: { id: key.id } });
    }
  });
});

describe('widget-load signal throttle', () => {
  it('writes once a minute per slug, whichever site framed the page', async () => {
    const where = { id: DEFAULT_WORKSPACE_ID };
    await db.workspace.update({ where, data: { lastWidgetLoadAt: null, lastWidgetOrigin: null } });
    const origin = async () => (await db.workspace.findUniqueOrThrow({ where })).lastWidgetOrigin;
    const slug = DEFAULT_WORKSPACE_SLUG;
    await recordWidgetLoad(db, slug, 'https://a.example', new Date(T0));
    expect(await origin()).toBe('https://a.example');
    await recordWidgetLoad(db, slug, 'https://b.example', new Date(T0 + 5_000));
    expect(await origin()).toBe('https://a.example');
    await recordWidgetLoad(db, slug, 'https://b.example', new Date(T0 + 61_000));
    expect(await origin()).toBe('https://b.example');
    await db.workspace.update({ where, data: { lastWidgetLoadAt: null, lastWidgetOrigin: null } });
  });
});
