import { z } from 'zod';
import { PRIORITIES, TICKET_STATUSES } from '../enums.js';

/** Ticket events a workspace's server can be told about. */
export const WEBHOOK_EVENTS = [
  'ticket.created',
  'ticket.replied',
  'ticket.status_changed',
] as const;
export const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export const WEBHOOK_DELIVERY_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED'] as const;
/** How many webhooks one workspace can have. */
export const MAX_WEBHOOKS_PER_WORKSPACE = 5;
/** Attempts per delivery before it is marked FAILED (an admin can then retry it). */
export const WEBHOOK_MAX_ATTEMPTS = 6;

const WebhookUrlSchema = z
  .url({ protocol: /^https?$/ })
  .trim()
  .max(2048)
  .regex(/^\S+$/, 'The address cannot contain spaces');
const WebhookEventListSchema = z.array(WebhookEventSchema).min(1).max(WEBHOOK_EVENTS.length);

export const CreateWebhookRequestSchema = z.object({
  url: WebhookUrlSchema,
  events: WebhookEventListSchema,
});
export type CreateWebhookRequest = z.infer<typeof CreateWebhookRequestSchema>;

/** Edit a webhook: its address, its events, or switch it on or off. At least one field. */
export const UpdateWebhookRequestSchema = z
  .object({
    url: WebhookUrlSchema.optional(),
    events: WebhookEventListSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => v.url !== undefined || v.events !== undefined || v.active !== undefined, {
    message: 'Change at least one of url, events or active',
  });
export type UpdateWebhookRequest = z.infer<typeof UpdateWebhookRequestSchema>;

export const WebhookDeliveryParamsSchema = z.object({ id: z.uuid(), deliveryId: z.uuid() });

export const WebhookDeliverySchema = z.object({
  id: z.string(),
  event: z.string(),
  status: z.enum(WEBHOOK_DELIVERY_STATUSES),
  attempts: z.int(),
  responseStatus: z.int().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  deliveredAt: z.string().nullable(),
  /** When a PENDING delivery is tried next; null once it succeeded or failed. */
  nextAttemptAt: z.string().nullable(),
});
export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;

export const WebhookSchema = z.object({
  id: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.string(),
  lastDelivery: WebhookDeliverySchema.nullable(),
});
export type Webhook = z.infer<typeof WebhookSchema>;

export const WebhookListSchema = z.object({ items: z.array(WebhookSchema) });

/** The signing secret is shown once: when the webhook is created and when it is rotated. */
export const CreatedWebhookSchema = z.object({
  webhook: WebhookSchema,
  signingSecret: z.string(),
});
export type CreatedWebhook = z.infer<typeof CreatedWebhookSchema>;

export const WebhookDeliveryListSchema = z.object({ items: z.array(WebhookDeliverySchema) });

/** A ticket as the workspace's own server sees it (server API and webhook payloads). */
export const ServerTicketSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: z.enum(TICKET_STATUSES),
  /** The workspace category's key. */
  category: z.string().nullable(),
  priority: z.enum(PRIORITIES),
  subject: z.string(),
  customerId: z.string(),
  itemId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ServerTicket = z.infer<typeof ServerTicketSchema>;

export const ServerMessageSchema = z.object({
  id: z.string(),
  kind: z.enum(['AUTHOR', 'REPLY', 'SYSTEM']),
  body: z.string(),
  createdAt: z.string(),
});

export const ServerTicketDetailSchema = ServerTicketSchema.extend({
  /** False once the ticket is solved or closed: customer messages get 409 until it is reopened. */
  canReply: z.boolean(),
  messages: z.array(ServerMessageSchema),
});
export type ServerTicketDetail = z.infer<typeof ServerTicketDetailSchema>;

export const ServerTicketPageSchema = z.object({
  items: z.array(ServerTicketSchema),
  nextCursor: z.string().nullable(),
});

export const ServerTicketQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  updatedSince: z.iso.datetime().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ServerTicketQuery = z.infer<typeof ServerTicketQuerySchema>;
