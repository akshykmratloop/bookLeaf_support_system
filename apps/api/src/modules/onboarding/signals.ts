import type { Db } from '../../platform/db.js';
import { asPlatform } from '../../platform/tenancy.js';

/**
 * The two real events the setup guide (U-12) waits for, kept as timestamps on the workspace row.
 * Each is written at most once a minute, so a busy product or a page full of widgets costs one
 * small UPDATE a minute. Raw SQL on purpose: these are not edits of the workspace, so its
 * `updated_at` stays as it was.
 */
export const SIGNAL_EVERY_MS = 60_000;

const cutoff = (now: Date) => new Date(now.getTime() - SIGNAL_EVERY_MS);

/**
 * A customer arrived from the product with a valid hand-over token. Runs inside the token's
 * workspace (row-level security: the app role may update only its own workspace row).
 */
export async function recordHandOver(db: Db, workspaceId: string, now: Date): Promise<void> {
  await db.$transaction(
    (tx) => tx.$executeRaw`
      UPDATE "workspaces" SET "last_hand_over_at" = ${now}
      WHERE "id" = ${workspaceId}::uuid
        AND ("last_hand_over_at" IS NULL OR "last_hand_over_at" < ${cutoff(now)})`,
  );
}

/**
 * Each copy writes a slug's widget load at most once a minute, whichever site framed it: a page
 * framed from many sites at once must not turn into a write per view. Bounded, oldest out first.
 */
const lastWidgetWrite = new Map<string, number>();
const MAX_THROTTLED_SLUGS = 10_000;

function widgetWriteDue(slug: string, now: Date): boolean {
  const last = lastWidgetWrite.get(slug);
  if (last !== undefined && now.getTime() - last < SIGNAL_EVERY_MS) return false;
  lastWidgetWrite.delete(slug);
  if (lastWidgetWrite.size >= MAX_THROTTLED_SLUGS) {
    const oldest = lastWidgetWrite.keys().next().value;
    if (oldest !== undefined) lastWidgetWrite.delete(oldest);
  }
  lastWidgetWrite.set(slug, now.getTime());
  return true;
}

/**
 * The widget page was framed by one of the workspace's allowed sites. Called from the public
 * widget page, before anyone signs in, so it finds the workspace by slug (platform scope). This
 * copy writes at most once a minute per slug; across copies, the database condition still skips
 * the same site within a minute (a different site is written, at most once a minute per copy).
 */
export async function recordWidgetLoad(
  db: Db,
  slug: string,
  origin: string,
  now: Date,
): Promise<void> {
  if (!widgetWriteDue(slug, now)) return;
  await asPlatform(
    () => db.$executeRaw`
      UPDATE "workspaces" SET "last_widget_load_at" = ${now}, "last_widget_origin" = ${origin}
      WHERE "slug" = ${slug}
        AND ("last_widget_load_at" IS NULL OR "last_widget_load_at" < ${cutoff(now)}
             OR "last_widget_origin" IS DISTINCT FROM ${origin})`,
  );
}
