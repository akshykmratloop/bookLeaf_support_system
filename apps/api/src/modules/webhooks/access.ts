import type { Prisma } from '@prisma/client';
import type { Clock } from '../../platform/clock.js';
import type { Envelope } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import { assertSafeUrl, UnsafeUrlError, type SsrfPolicy } from '../../platform/net/ssrf.js';
import type { Session } from '../auth/session.js';

export interface WebhookDeps {
  db: Db;
  clock: Clock;
  envelope: Envelope | null;
  ssrf: SsrfPolicy;
}

/** Include for the newest delivery, shown on each webhook row. */
export const LATEST = { orderBy: { createdAt: 'desc' as const }, take: 1 };

/** An audit row for a change to a webhook, in the admin's workspace. */
export const audit = (s: Session, action: string, id: string, after: Prisma.InputJsonObject) => ({
  data: {
    workspaceId: s.workspaceId,
    actorId: s.userId,
    entityType: 'workspace_webhook',
    entityId: id,
    action,
    after,
  },
});

/** The URL must be one the dispatcher would be allowed to call (same SSRF rules). */
export async function checkUrl(deps: WebhookDeps, url: string): Promise<void> {
  try {
    await assertSafeUrl(url, deps.ssrf);
  } catch (err) {
    if (!(err instanceof UnsafeUrlError)) throw err;
    throw new ValidationError('This address cannot receive webhooks', [
      { path: 'url', message: err.message },
    ]);
  }
}

/** The webhook, only if it belongs to the admin's workspace; another workspace's is a 404. */
export async function ownWebhook(deps: WebhookDeps, s: Session, id: string) {
  const w = await deps.db.workspaceWebhook.findFirst({ where: { id, workspaceId: s.workspaceId } });
  if (!w) throw new NotFoundError('Webhook');
  return w;
}
