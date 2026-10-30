import { z } from 'zod';
import { cleanText } from '../sanitize.js';
import { HostIdSchema } from './host.js';
import { DESCRIPTION_LIMITS, MESSAGE_LIMITS, SUBJECT_LIMITS } from './tickets.js';

/**
 * Writes the workspace's own server makes with an API key (U-11). Customers and items are named
 * by the product's own ids, the same ids the sign-in token and the customer endpoint use.
 */
export const ServerCustomerParamSchema = z.object({ customerId: HostIdSchema });

/** Raise a ticket for one customer (scope `tickets:write`). Triage runs as for any ticket. */
export const ServerCreateTicketSchema = z.object({
  customerId: HostIdSchema,
  subject: cleanText(SUBJECT_LIMITS.min, SUBJECT_LIMITS.max),
  body: cleanText(DESCRIPTION_LIMITS.min, DESCRIPTION_LIMITS.max),
  /** The product's item id (a book), or null/absent for an account-level ticket. */
  itemId: HostIdSchema.nullable().default(null),
});
export type ServerCreateTicket = z.output<typeof ServerCreateTicketSchema>;

/** A message from the customer on their ticket (scope `tickets:write`). */
export const ServerMessageRequestSchema = z.object({
  body: cleanText(MESSAGE_LIMITS.min, MESSAGE_LIMITS.max),
});
export type ServerMessageRequest = z.output<typeof ServerMessageRequestSchema>;

/** Resolve, close or reopen a ticket (scope `tickets:write`). */
export const SERVER_STATUS_TARGETS = ['RESOLVED', 'CLOSED', 'OPEN'] as const;
export const ServerStatusChangeSchema = z.object({ status: z.enum(SERVER_STATUS_TARGETS) });
export type ServerStatusChange = z.output<typeof ServerStatusChangeSchema>;
