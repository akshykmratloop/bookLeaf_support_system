import type {
  CreatedWebhook,
  UpdateWebhookRequest,
  Webhook,
  WebhookDelivery,
} from '@bookleaf/shared';
import { ConflictError, NotFoundError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { SecretsNotConfiguredError } from '../connectors/store.js';
import { audit, checkUrl, LATEST, ownWebhook, type WebhookDeps } from './access.js';
import { newSigningSecret } from './signing.js';
import { aadForWebhook, toDeliveryDto, toWebhookDto } from './store.js';

/** Edits the address or events, or switches the webhook on or off. */
export async function updateWebhook(
  deps: WebhookDeps,
  s: Session,
  id: string,
  input: UpdateWebhookRequest,
): Promise<Webhook> {
  const w = await ownWebhook(deps, s, id);
  if (input.url !== undefined) await checkUrl(deps, input.url);
  const data = {
    ...(input.url === undefined ? {} : { url: input.url }),
    ...(input.events === undefined ? {} : { events: [...new Set(input.events)] }),
    ...(input.active === undefined ? {} : { active: input.active }),
  };
  const row = await deps.db.$transaction(async (tx) => {
    const updated = await tx.workspaceWebhook.update({
      where: { id: w.id },
      data,
      include: { deliveries: LATEST },
    });
    await tx.auditEvent.create(audit(s, 'webhook.updated', w.id, data));
    return updated;
  });
  return toWebhookDto(row);
}

/**
 * Replaces the signing secret and returns the new one once. Deliveries are signed when they are
 * sent, so every delivery from now on (retries of older ones too) uses the new secret.
 */
export async function rotateSecret(
  deps: WebhookDeps,
  s: Session,
  id: string,
): Promise<CreatedWebhook> {
  if (!deps.envelope) throw new SecretsNotConfiguredError();
  const w = await ownWebhook(deps, s, id);
  const signingSecret = newSigningSecret();
  const secretEnc = deps.envelope.encrypt(signingSecret, aadForWebhook(w));
  const row = await deps.db.$transaction(async (tx) => {
    const updated = await tx.workspaceWebhook.update({
      where: { id: w.id },
      data: { secretEnc },
      include: { deliveries: LATEST },
    });
    await tx.auditEvent.create(audit(s, 'webhook.secret_rotated', w.id, { url: w.url }));
    return updated;
  });
  return { webhook: toWebhookDto(row), signingSecret };
}

/** Sends a FAILED delivery again, with a fresh set of attempts. */
export async function retryDelivery(
  deps: WebhookDeps,
  s: Session,
  id: string,
  deliveryId: string,
): Promise<WebhookDelivery> {
  const w = await ownWebhook(deps, s, id);
  if (!w.active) throw new ConflictError('WEBHOOK_DISABLED', 'Switch the webhook on first');
  const d = await deps.db.webhookDelivery.findFirst({ where: { id: deliveryId, webhookId: w.id } });
  if (!d) throw new NotFoundError('Delivery');
  const row = await deps.db.$transaction(async (tx) => {
    // Only a FAILED row is reset, so two clicks (or a race) cannot queue it twice.
    const reset = await tx.webhookDelivery.updateMany({
      where: { id: d.id, status: 'FAILED' },
      data: { status: 'PENDING', attempts: 0, nextAttemptAt: deps.clock.now(), leaseUntil: null },
    });
    if (reset.count === 0)
      throw new ConflictError('DELIVERY_NOT_FAILED', 'Only a failed delivery can be retried');
    await tx.auditEvent.create(audit(s, 'webhook.delivery_retried', w.id, { deliveryId: d.id }));
    return tx.webhookDelivery.findUniqueOrThrow({ where: { id: d.id } });
  });
  return toDeliveryDto(row);
}
