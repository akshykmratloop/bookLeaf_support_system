import { z } from 'zod';
import { sharedChannel } from './shared-state/channel.js';
import type { SharedState, SharedStateLog } from './shared-state/types.js';

/** Ticket change notifications. Events are hints only: clients refetch through REST. */
export const TICKET_EVENT_TYPES = [
  'ticket.created',
  'ticket.updated',
  'ticket.replied',
  'ticket.status_changed',
  'ticket.note_added',
  'ticket.draft_ready',
] as const;
export type TicketEventType = (typeof TICKET_EVENT_TYPES)[number];

/** Checked again when the event arrives from another copy. */
export const TicketEventSchema = z.object({
  type: z.enum(TICKET_EVENT_TYPES),
  ticketId: z.guid(),
  /** The ticket's workspace: nobody outside it ever receives the event. */
  workspaceId: z.guid(),
  authorId: z.guid(),
  /** True when the author may see this event (public reply or status change). */
  authorVisible: z.boolean(),
});
export type TicketEvent = z.infer<typeof TicketEventSchema>;

export type Listener = (event: TicketEvent) => void;

export interface EventBus {
  publish(event: TicketEvent): void;
  subscribe(listener: Listener): () => void;
}

/**
 * Every copy's listeners hear every event: this copy's at once, the others through pub/sub
 * (F-19), so a browser connected to one server hears about a ticket changed on another.
 */
export function sharedEventBus(state: SharedState, log: SharedStateLog) {
  const channel = sharedChannel(state, 'ticket-events', TicketEventSchema, log);
  const bus: EventBus = { publish: channel.publish, subscribe: channel.listen };
  return { bus, ready: channel.ready, close: channel.close };
}
