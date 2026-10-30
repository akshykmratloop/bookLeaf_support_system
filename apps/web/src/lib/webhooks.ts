import { useQuery } from '@tanstack/react-query';
import type {
  CreatedWebhook,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  Webhook,
  WebhookDelivery,
} from '@bookleaf/shared';
import { api } from './api';

export const webhookKeys = {
  all: ['workspace', 'webhooks'] as const,
  deliveries: (id: string) => ['workspace', 'webhooks', id, 'deliveries'] as const,
};

const PATH = '/workspace/webhooks';

const POLL_MS = 5000;
const isWaiting = (d: WebhookDelivery | null | undefined) => d?.status === 'PENDING';

/** The webhooks; refreshed while a last delivery is still waiting, so its status stays current. */
export const useWebhooks = () =>
  useQuery({
    queryKey: webhookKeys.all,
    queryFn: () => api<{ items: Webhook[] }>(PATH).then((r) => r.items),
    refetchInterval: (q) =>
      q.state.data?.some((w) => isWaiting(w.lastDelivery)) ? POLL_MS : false,
  });

/** The 20 latest deliveries; refreshed while any of them is still waiting to be sent. */
export const useWebhookDeliveries = (id: string) =>
  useQuery({
    queryKey: webhookKeys.deliveries(id),
    queryFn: () =>
      api<{ items: WebhookDelivery[] }>(`${PATH}/${id}/deliveries`).then((r) => r.items),
    refetchInterval: (q) => (q.state.data?.some(isWaiting) ? POLL_MS : false),
  });

export const createWebhook = (input: CreateWebhookRequest) =>
  api<CreatedWebhook>(PATH, { method: 'POST', body: input });

export const updateWebhook = ({ id, input }: { id: string; input: UpdateWebhookRequest }) =>
  api<Webhook>(`${PATH}/${id}`, { method: 'PATCH', body: input });

export const deleteWebhook = (id: string) => api<void>(`${PATH}/${id}`, { method: 'DELETE' });

export const rotateWebhookSecret = (id: string) =>
  api<CreatedWebhook>(`${PATH}/${id}/rotate-secret`, { method: 'POST' });

export const sendWebhookTest = (id: string) =>
  api<WebhookDelivery>(`${PATH}/${id}/test`, { method: 'POST' });

export const retryWebhookDelivery = ({ id, deliveryId }: { id: string; deliveryId: string }) =>
  api<WebhookDelivery>(`${PATH}/${id}/deliveries/${deliveryId}/retry`, { method: 'POST' });
