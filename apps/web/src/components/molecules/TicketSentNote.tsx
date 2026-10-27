import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Card } from '../atoms/Card';

/** "Ticket BL-1002 was sent from …": links to the ticket the conversation produced. */
export function TicketSentNote({
  ticket,
  children,
}: {
  ticket: { id: string; number: string };
  /** The rest of the sentence, after the ticket number. */
  children: ReactNode;
}) {
  return (
    <Card className="p-3 text-[13px]">
      Ticket{' '}
      <Link className="font-semibold text-brand underline" to={`/tickets/${ticket.id}`}>
        {ticket.number}
      </Link>{' '}
      {children}
    </Card>
  );
}
