import type { WebhookDelivery, WorkspaceWebhook } from '@prisma/client';
import type { Webhook, WebhookDelivery as DeliveryDto } from '@bookleaf/shared';

/** AAD binds the encrypted signing secret to its webhook row. */
export const aadForWebhook = (w: Pick<WorkspaceWebhook, 'id' | 'workspaceId'>) =>
  `webhook:${w.workspaceId}:${w.id}`;

export const toDeliveryDto = (d: WebhookDelivery): DeliveryDto => ({
  id: d.id,
  event: d.event,
  status: d.status,
  attempts: d.attempts,
  responseStatus: d.responseStatus,
  lastError: d.lastError,
  createdAt: d.createdAt.toISOString(),
  deliveredAt: d.deliveredAt?.toISOString() ?? null,
});

export const toWebhookDto = (
  w: WorkspaceWebhook & { deliveries?: WebhookDelivery[] },
): Webhook => ({
  id: w.id,
  url: w.url,
  events: w.events,
  active: w.active,
  createdAt: w.createdAt.toISOString(),
  lastDelivery: w.deliveries?.[0] ? toDeliveryDto(w.deliveries[0]) : null,
});
