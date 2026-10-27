import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Card } from '../atoms/Card';
import { authorPaths } from '../../lib/paths';

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
      <Link className="font-semibold text-brand underline" to={authorPaths.ticket(ticket.id)}>
        {ticket.number}
      </Link>{' '}
      {children}
    </Card>
  );
}
