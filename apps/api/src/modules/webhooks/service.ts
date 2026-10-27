import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type {
  CreatedWebhook,
  CreateWebhookRequest,
  Webhook,
  WebhookDelivery,
} from '@bookleaf/shared';
import type { Clock } from '../../platform/clock.js';
import type { Envelope } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import { assertSafeUrl, UnsafeUrlError, type SsrfPolicy } from '../../platform/net/ssrf.js';
import type { Session } from '../auth/session.js';
import { SecretsNotConfiguredError } from '../connectors/store.js';
import { newSigningSecret } from './signing.js';
import { aadForWebhook, toDeliveryDto, toWebhookDto } from './store.js';

export interface WebhookDeps {
  db: Db;
  clock: Clock;
  envelope: Envelope | null;
  ssrf: SsrfPolicy;
}

const MAX_WEBHOOKS = 5;
const LATEST = { orderBy: { createdAt: 'desc' as const }, take: 1 };

const audit = (s: Session, action: string, id: string, after: Prisma.InputJsonObject) => ({
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
async function checkUrl(deps: WebhookDeps, url: string) {
  try {
    await assertSafeUrl(url, deps.ssrf);
  } catch (err) {
    if (!(err instanceof UnsafeUrlError)) throw err;
    throw new ValidationError('This address cannot receive webhooks', [
      { path: 'url', message: err.message },
    ]);
  }
}

async function createWebhook(
  deps: WebhookDeps,
  s: Session,
  input: CreateWebhookRequest,
): Promise<CreatedWebhook> {
  if (!deps.envelope) throw new SecretsNotConfiguredError();
  await checkUrl(deps, input.url);
  const count = await deps.db.workspaceWebhook.count({ where: { workspaceId: s.workspaceId } });
  if (count >= MAX_WEBHOOKS)
    throw new ValidationError(`A workspace can have ${MAX_WEBHOOKS} webhooks`);
  const id = randomUUID();
  const signingSecret = newSigningSecret();
  const secretEnc = deps.envelope.encrypt(
    signingSecret,
    aadForWebhook({ id, workspaceId: s.workspaceId }),
  );
  const events = [...new Set(input.events)];
  const row = await deps.db.$transaction(async (tx) => {
    const w = await tx.workspaceWebhook.create({
      data: {
        id,
        workspaceId: s.workspaceId,
        url: input.url,
        events,
        secretEnc,
        createdById: s.userId,
      },
    });
    await tx.auditEvent.create(audit(s, 'webhook.created', id, { url: input.url, events }));
    return w;
  });
  return { webhook: toWebhookDto(row), signingSecret };
}

async function ownWebhook(deps: WebhookDeps, s: Session, id: string) {
  const w = await deps.db.workspaceWebhook.findFirst({ where: { id, workspaceId: s.workspaceId } });
  if (!w) throw new NotFoundError('Webhook');
  return w;
}

async function removeWebhook(deps: WebhookDeps, s: Session, id: string): Promise<void> {
  const w = await ownWebhook(deps, s, id);
  await deps.db.$transaction([
    deps.db.workspaceWebhook.delete({ where: { id: w.id } }),
    deps.db.auditEvent.create(audit(s, 'webhook.deleted', w.id, { url: w.url })),
  ]);
}

/** Queues a `webhook.test` delivery so the admin can check the receiver and its signature check. */
async function sendTest(deps: WebhookDeps, s: Session, id: string): Promise<WebhookDelivery> {
  const w = await ownWebhook(deps, s, id);
  const d = await deps.db.webhookDelivery.create({
    data: {
      webhookId: w.id,
      event: 'webhook.test',
      payload: { message: 'Test delivery from BookLeaf Support' },
      nextAttemptAt: deps.clock.now(),
    },
  });
  return toDeliveryDto(d);
}

/** A workspace's webhooks: where its own server hears about ticket events, signed per webhook. */
export function createWebhookService(deps: WebhookDeps) {
  return {
    async list(s: Session): Promise<{ items: Webhook[] }> {
      const rows = await deps.db.workspaceWebhook.findMany({
        where: { workspaceId: s.workspaceId },
        orderBy: { createdAt: 'asc' },
        include: { deliveries: LATEST },
      });
      return { items: rows.map(toWebhookDto) };
    },
    create: (s: Session, input: CreateWebhookRequest) => createWebhook(deps, s, input),
    remove: (s: Session, id: string) => removeWebhook(deps, s, id),
    test: (s: Session, id: string) => sendTest(deps, s, id),
    async deliveries(s: Session, id: string): Promise<{ items: WebhookDelivery[] }> {
      const w = await ownWebhook(deps, s, id);
      const rows = await deps.db.webhookDelivery.findMany({
        where: { webhookId: w.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      return { items: rows.map(toDeliveryDto) };
    },
  };
}

export type WebhookService = ReturnType<typeof createWebhookService>;
