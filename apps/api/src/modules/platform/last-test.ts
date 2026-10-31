import type { PlatformAiStatus } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { asPlatform } from '../../platform/tenancy.js';

type LastTest = PlatformAiStatus['lastTest'];

/** The console's last "Test connection" result, read from the platform settings row. */
export async function readLastTest(db: Db): Promise<LastTest> {
  const row = await asPlatform(() =>
    db.platformSettings.findUnique({
      where: { id: 1 },
      select: { lastTestAt: true, lastTestOk: true, lastTestDetail: true },
    }),
  );
  if (!row?.lastTestAt || row.lastTestOk === null) return null;
  return { ok: row.lastTestOk, at: row.lastTestAt.toISOString(), detail: row.lastTestDetail ?? '' };
}

/** Stores a test result for every copy of the API (the settings row is seeded, so it exists). */
export async function saveLastTest(
  db: Db,
  result: { ok: boolean; detail: string },
  at: Date,
): Promise<void> {
  await asPlatform(() =>
    db.platformSettings.updateMany({
      where: { id: 1 },
      data: { lastTestAt: at, lastTestOk: result.ok, lastTestDetail: result.detail },
    }),
  );
}
