import { z } from 'zod';
import { TICKET_STATUSES } from '../enums.js';

/** One label and value in the staff Customer panel, e.g. { label: "Plan", display: "Pro" }. */
export const CustomerLineSchema = z.object({ label: z.string(), display: z.string() });
export type CustomerLine = z.infer<typeof CustomerLineSchema>;

/** Something the customer has with the product (for BookLeaf: a book) and its lines. */
export const CustomerItemSchema = z.object({
  /** Our reference id (null if the item is not stored on our side yet). */
  id: z.uuid().nullable(),
  externalId: z.string(),
  title: z.string(),
  /** The item this ticket is about. */
  isTicketItem: z.boolean(),
  lines: z.array(CustomerLineSchema),
});
export type CustomerItem = z.infer<typeof CustomerItemSchema>;

/** Another ticket of the same customer in the same workspace. */
export const CustomerTicketSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  subject: z.string(),
  status: z.enum(TICKET_STATUSES),
  createdAt: z.iso.datetime(),
});
export type CustomerTicket = z.infer<typeof CustomerTicketSchema>;

/**
 * `GET /tickets/:id/customer` (staff only, U-1): who raised the ticket, what the customer record
 * says about them (labelled by the workspace's customer data fields) and their other tickets.
 */
export const TicketCustomerSchema = z.object({
  name: z.string(),
  email: z.string(),
  externalId: z.string(),
  /** False while the product cannot answer: the profile and tickets still show, the lines do not. */
  recordsAvailable: z.boolean(),
  /** The workspace's word for an item (Workspace Settings), e.g. "book"; default "item". */
  itemNoun: z.string(),
  account: z.array(CustomerLineSchema),
  items: z.array(CustomerItemSchema),
  /** Newest first, at most CUSTOMER_TICKETS_SHOWN; `otherTicketsTotal` counts them all. */
  otherTickets: z.array(CustomerTicketSchema),
  otherTicketsTotal: z.int().min(0),
});
export type TicketCustomer = z.infer<typeof TicketCustomerSchema>;

export const CUSTOMER_TICKETS_SHOWN = 50;
