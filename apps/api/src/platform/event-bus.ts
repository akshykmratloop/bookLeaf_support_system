/** Ticket change notifications. Events are hints only: clients refetch through REST. */
export type TicketEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.replied'
  | 'ticket.status_changed'
  | 'ticket.note_added'
  | 'ticket.draft_ready';

export interface TicketEvent {
  type: TicketEventType;
  ticketId: string;
  /** The ticket's workspace: nobody outside it ever receives the event. */
  workspaceId: string;
  authorId: string;
  /** True when the author may see this event (public reply or status change). */
  authorVisible: boolean;
}

export type Listener = (event: TicketEvent) => void;

export interface EventBus {
  publish(event: TicketEvent): void;
  subscribe(listener: Listener): () => void;
}

/** Single-instance bus. A multi-instance deployment would swap in Postgres LISTEN/NOTIFY. */
export function inMemoryEventBus(): EventBus {
  const listeners = new Set<Listener>();
  return {
    publish(event) {
      for (const listener of listeners) listener(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
