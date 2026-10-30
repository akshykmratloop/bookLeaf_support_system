import type { AuthorTicket } from '@bookleaf/shared';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { keys, useApiMutation } from '../../lib/queries';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { useToast } from '../molecules/Toast';

/** "My issue is sorted": the author closes their own request, after one confirmation. */
export function SolveTicketCard({ ticketId }: { ticketId: string }) {
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const solve = useApiMutation(
    () => api<AuthorTicket>(`/tickets/${ticketId}/solve`, { method: 'POST', body: {} }),
    [keys.ticket(ticketId), keys.tickets()],
  );
  const confirm = () =>
    solve.mutate(undefined, {
      onSuccess: () => toast('success', 'Marked as solved. Thank you!'),
      onError: (err) => toast('error', errorMessage(err)),
      onSettled: () => setAsking(false),
    });
  return (
    <Card variant="flat" className="flex flex-col gap-3 p-4">
      <p className="flex items-center gap-2 text-[14px] font-bold">
        <CheckCircle2 size={17} aria-hidden className="text-success" /> Is your issue sorted?
      </p>
      <p className="text-[12.5px] text-ink-2">
        Mark the ticket as solved. It then closes for replies; you can raise a new ticket any time.
      </p>
      {asking ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={confirm} isLoading={solve.isPending}>
            Yes, it's solved
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
            Not yet
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setAsking(true)}>
          Mark as solved
        </Button>
      )}
    </Card>
  );
}
