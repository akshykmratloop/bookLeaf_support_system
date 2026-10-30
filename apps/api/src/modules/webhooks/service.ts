import { randomUUID } from 'node:crypto';
import {
  MAX_WEBHOOKS_PER_WORKSPACE as MAX_WEBHOOKS,
  type CreatedWebhook,
  type CreateWebhookRequest,
  type UpdateWebhookRequest,
  type Webhook,
  type WebhookDelivery,
} from '@bookleaf/shared';
import { ConflictError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { SecretsNotConfiguredError } from '../connectors/store.js';
import { audit, checkUrl, LATEST, ownWebhook, type WebhookDeps } from './access.js';
import { retryDelivery, rotateSecret, updateWebhook } from './edit.js';
import { newSigningSecret } from './signing.js';
import { aadForWebhook, toDeliveryDto, toWebhookDto } from './store.js';

export type { WebhookDeps } from './access.js';

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

async function removeWebhook(deps: WebhookDeps, s: Session, id: string): Promise<void> {
  const w = await ownWebhook(deps, s, id);
  await deps.db.$transaction(async (tx) => {
    await tx.workspaceWebhook.delete({ where: { id: w.id } });
    await tx.auditEvent.create(audit(s, 'webhook.deleted', w.id, { url: w.url }));
  });
}

/** Queues a `webhook.test` delivery so the admin can check the receiver and its signature check. */
async function sendTest(deps: WebhookDeps, s: Session, id: string): Promise<WebhookDelivery> {
  const w = await ownWebhook(deps, s, id);
  if (!w.active)
    throw new ConflictError('WEBHOOK_DISABLED', 'Switch the webhook on to send a test');
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
    update: (s: Session, id: string, input: UpdateWebhookRequest) =>
      updateWebhook(deps, s, id, input),
    rotateSecret: (s: Session, id: string) => rotateSecret(deps, s, id),
    test: (s: Session, id: string) => sendTest(deps, s, id),
    retry: (s: Session, id: string, deliveryId: string) => retryDelivery(deps, s, id, deliveryId),
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
