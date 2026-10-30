import { MESSAGE_LIMITS, type AuthorTicket } from '@bookleaf/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage, isApiError } from '../../lib/api';
import { newRequestKey } from '../../lib/ids';
import { keys, useApiMutation } from '../../lib/queries';
import { Spinner } from '../atoms/Spinner';
import { useToast } from '../molecules/Toast';

/**
 * The author's reply on an open ticket. If the ticket was solved meanwhile (409), the ticket is
 * reloaded so the page swaps this box for the "Raise a new ticket" note (U-2).
 */
export function TicketReplyBox({ ticketId }: { ticketId: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [requestKey, setRequestKey] = useState(newRequestKey);
  const send = useApiMutation(
    (text: string) =>
      api<AuthorTicket>(`/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: { body: text },
        idempotencyKey: requestKey,
      }),
    [keys.ticket(ticketId), keys.tickets()],
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    send.mutate(body, {
      onSuccess: () => {
        setBody('');
        setRequestKey(newRequestKey());
        toast('success', 'Message sent');
      },
      onError: (err) => {
        toast('error', errorMessage(err));
        if (isApiError(err) && err.status === 409)
          void qc.invalidateQueries({ queryKey: keys.ticket(ticketId) });
      },
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <label htmlFor="followup" className="px-1 text-[12.5px] font-semibold text-ink-2">
        Reply to the team
      </label>
      <div className="flex items-end gap-2 rounded-[22px] border border-line bg-panel p-2 pl-4 shadow-lift focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/60">
        <textarea
          id="followup"
          name="body"
          rows={2}
          value={body}
          maxLength={MESSAGE_LIMITS.max}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="max-h-48 min-h-12 flex-1 resize-none bg-transparent py-2 text-[14px] leading-snug [field-sizing:content] placeholder:text-ink-3 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!body.trim() || send.isPending}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white shadow-soft hover:bg-brand-strong disabled:opacity-35"
        >
          {send.isPending ? <Spinner size={16} /> : <ArrowUp size={18} aria-hidden />}
        </button>
      </div>
    </form>
  );
}
