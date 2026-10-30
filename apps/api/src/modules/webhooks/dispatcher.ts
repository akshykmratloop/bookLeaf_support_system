import type { WebhookDelivery, WorkspaceWebhook } from '@prisma/client';
import type { Clock } from '../../platform/clock.js';
import type { Envelope } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import { assertSafeUrl, type SsrfPolicy } from '../../platform/net/ssrf.js';
import { aadForWebhook } from './store.js';
import { signatureHeader } from './signing.js';
import { asPlatform } from '../../platform/tenancy.js';

/** Sends one HTTP request; the default is fetch. Tests use a real local server. */
export type Send = (url: string, init: RequestInit) => Promise<{ status: number }>;

export interface DispatcherDeps {
  db: Db;
  clock: Clock;
  envelope: Envelope | null;
  ssrf: SsrfPolicy;
  send?: Send;
  log: { warn(o: object, msg: string): void; error(o: object, msg: string): void };
}

export const MAX_ATTEMPTS = 6;
const BATCH = 10;
const LEASE_MS = 30_000;
const TIMEOUT_MS = 5_000;
const BASE_BACKOFF_MS = 30_000;

/** 30 s, 1 min, 2 min, 4 min, 8 min, plus up to 20% jitter so retries do not arrive in step. */
export const backoffMs = (attempts: number, random = Math.random) =>
  BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1) * (1 + random() * 0.2);

/** Leases up to BATCH due deliveries; SKIP LOCKED lets several workers share the table. */
async function claimDue(db: Db, now: Date): Promise<string[]> {
  const until = new Date(now.getTime() + LEASE_MS);
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE webhook_deliveries SET lease_until = ${until}, attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM webhook_deliveries
      WHERE status = 'PENDING' AND next_attempt_at <= ${now}
        AND (lease_until IS NULL OR lease_until < ${now})
      ORDER BY next_attempt_at LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return rows.map((r) => r.id);
}

type Loaded = WebhookDelivery & { webhook: WorkspaceWebhook };

/** One signed POST. Redirects are not followed and the address is re-checked at send time. */
async function post(deps: DispatcherDeps, d: Loaded): Promise<number> {
  if (!deps.envelope) throw new Error('no master key: the signing secret cannot be read');
  await assertSafeUrl(d.webhook.url, deps.ssrf);
  const secret = deps.envelope.decrypt(d.webhook.secretEnc, aadForWebhook(d.webhook));
  const body = JSON.stringify({
    id: d.id,
    type: d.event,
    createdAt: d.createdAt.toISOString(),
    data: d.payload,
  });
  const ts = Math.floor(deps.clock.now().getTime() / 1000);
  const send: Send = deps.send ?? fetch;
  const res = await send(d.webhook.url, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'content-type': 'application/json',
      'user-agent': 'BookLeaf-Support-Webhooks/1',
      'x-bookleaf-event': d.event,
      'x-bookleaf-delivery': d.id,
      'x-bookleaf-signature': signatureHeader(secret, ts, body),
    },
    body,
  });
  return res.status;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'failed').slice(0, 300);

const isSuccess = (status: number | null) => status !== null && status >= 200 && status < 300;

/** What a finished attempt means for the delivery row. */
function outcome(d: Loaded, status: number | null, error: string | null, now: Date) {
  const keep = d.nextAttemptAt;
  if (isSuccess(status))
    return { status: 'SUCCEEDED' as const, lastError: null, deliveredAt: now, nextAttemptAt: keep };
  const lastError = error ?? `HTTP ${status}`;
  if (d.attempts >= MAX_ATTEMPTS)
    return { status: 'FAILED' as const, lastError, deliveredAt: null, nextAttemptAt: keep };
  const nextAttemptAt = new Date(now.getTime() + backoffMs(d.attempts));
  return { status: 'PENDING' as const, lastError, deliveredAt: null, nextAttemptAt };
}

/** Records the outcome: 2xx is done; otherwise retry with backoff until MAX_ATTEMPTS. */
async function settle(
  deps: DispatcherDeps,
  d: Loaded,
  status: number | null,
  error: string | null,
) {
  const result = outcome(d, status, error, deps.clock.now());
  await deps.db.webhookDelivery.update({
    where: { id: d.id },
    data: { ...result, responseStatus: status, leaseUntil: null },
  });
  if (result.status === 'FAILED')
    deps.log.warn({ deliveryId: d.id, webhookId: d.webhookId }, 'webhook delivery gave up');
}

async function deliverOne(deps: DispatcherDeps, id: string): Promise<void> {
  const d = await deps.db.webhookDelivery.findUnique({ where: { id }, include: { webhook: true } });
  if (!d) return;
  try {
    await settle(deps, d, await post(deps, d), null);
  } catch (err) {
    await settle(deps, d, null, errorText(err));
  }
}

/** Polls the outbox. One failing receiver never blocks the others: each delivery is separate. */
export function createWebhookDispatcher(deps: DispatcherDeps, opts: { pollMs: number }) {
  let running = false;
  let loop: Promise<void> | null = null;
  // Background work for every workspace: the platform (owner) path (S.8).
  const runOnce = (): Promise<number> =>
    asPlatform(async () => {
      const ids = await claimDue(deps.db, deps.clock.now());
      await Promise.all(ids.map((id) => deliverOne(deps, id)));
      return ids.length;
    });
  const tick = async () => {
    while (running) {
      const sent = await runOnce().catch((err: unknown) => {
        deps.log.error({ err }, 'webhook dispatcher poll failed');
        return 0;
      });
      if (sent === 0) await new Promise((r) => setTimeout(r, opts.pollMs));
    }
  };
  return {
    start() {
      if (running) return;
      running = true;
      loop = tick();
    },
    async stop() {
      running = false;
      await loop;
    },
    runOnce,
  };
}

export type WebhookDispatcher = ReturnType<typeof createWebhookDispatcher>;
