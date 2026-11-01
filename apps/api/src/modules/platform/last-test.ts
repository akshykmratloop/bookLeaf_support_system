import type { PlatformAiStatus } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { asPlatform } from '../../platform/tenancy.js';

type LastTest = PlatformAiStatus['lastTest'];
export type TestResult = { ok: boolean; detail: string };
export type TestResults = { ai: TestResult; voice: TestResult };

const pick = (at: Date | null, ok: boolean | null, detail: string | null): LastTest =>
  at && ok !== null ? { ok, at: at.toISOString(), detail: detail ?? '' } : null;

/** The console's last "Test connection" results (AI and voice), read from the platform settings row. */
export async function readLastTests(db: Db): Promise<{ ai: LastTest; voice: LastTest }> {
  const row = await asPlatform(() =>
    db.platformSettings.findUnique({
      where: { id: 1 },
      select: {
        lastTestAt: true,
        lastTestOk: true,
        lastTestDetail: true,
        lastVoiceTestAt: true,
        lastVoiceTestOk: true,
        lastVoiceTestDetail: true,
      },
    }),
  );
  if (!row) return { ai: null, voice: null };
  return {
    ai: pick(row.lastTestAt, row.lastTestOk, row.lastTestDetail),
    voice: pick(row.lastVoiceTestAt, row.lastVoiceTestOk, row.lastVoiceTestDetail),
  };
}

/** Stores both results for every copy of the API (the settings row is seeded, so it exists). */
export async function saveLastTests(db: Db, results: TestResults, at: Date): Promise<void> {
  await asPlatform(() =>
    db.platformSettings.updateMany({
      where: { id: 1 },
      data: {
        lastTestAt: at,
        lastTestOk: results.ai.ok,
        lastTestDetail: results.ai.detail,
        lastVoiceTestAt: at,
        lastVoiceTestOk: results.voice.ok,
        lastVoiceTestDetail: results.voice.detail,
      },
    }),
  );
}
