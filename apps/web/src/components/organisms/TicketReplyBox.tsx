import { MESSAGE_LIMITS, type AuthorTicket } from '@bookleaf/shared';
import { ArrowUp } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../../lib/api';
import { newRequestKey } from '../../lib/ids';
import { keys, useApiMutation } from '../../lib/queries';
import { Spinner } from '../atoms/Spinner';
import { useToast } from '../molecules/Toast';

/** The author's reply. On a solved or closed ticket, sending one opens it again. */
export function TicketReplyBox({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  const toast = useToast();
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
      onError: (err) => toast('error', errorMessage(err)),
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <label htmlFor="followup" className="px-1 text-[12.5px] font-semibold text-ink-2">
        {closed ? 'Need more help? Replying opens this ticket again.' : 'Reply to the team'}
      </label>
      <div className="flex items-end gap-2 rounded-[22px] border border-line bg-panel p-2 pl-4 shadow-lift focus-within:border-brand/50">
        <textarea
          id="followup"
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
