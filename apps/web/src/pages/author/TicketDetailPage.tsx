import { MESSAGE_LIMITS, type AuthorTicket } from '@bookleaf/shared';
import { ArrowLeft, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { Textarea } from '../../components/atoms/Input';
import { StatusPill } from '../../components/molecules/DomainPills';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { MessageThread } from '../../components/organisms/MessageThread';
import { api, errorMessage } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { newRequestKey } from '../../lib/ids';
import { keys, useApiMutation, useAuthorTicket } from '../../lib/queries';

function FollowUp({ ticketId, closed }: { ticketId: string; closed: boolean }) {
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
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
      <label htmlFor="followup" className="text-[12.5px] font-semibold text-ink-2">
        {closed ? 'Need more help? Sending a message reopens this ticket.' : 'Add a message'}
      </label>
      <Textarea
        id="followup"
        rows={3}
        value={body}
        maxLength={MESSAGE_LIMITS.max}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          isLoading={send.isPending}
          disabled={!body.trim()}
          icon={<Send size={14} aria-hidden />}
        >
          Send
        </Button>
      </div>
    </form>
  );
}

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const ticket = useAuthorTicket(id);
  if (ticket.isPending) return <LoadingState label="Loading ticket…" />;
  if (ticket.isError)
    return (
      <ErrorState message={errorMessage(ticket.error)} onRetry={() => void ticket.refetch()} />
    );
  const t = ticket.data;
  const closed = t.status === 'RESOLVED' || t.status === 'CLOSED';
  return (
    <div className="max-w-[820px]">
      <Link
        to="/tickets"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden /> All tickets
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-ink-3">{t.number}</p>
          <h1 className="text-[22px] font-semibold break-words">{t.subject}</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {t.book?.title ?? 'General / Account level'} · opened {dateTime(t.createdAt)}
          </p>
        </div>
        <StatusPill status={t.status} />
      </div>
      <Card className="p-4 md:p-5">
        <MessageThread description={t.description} messages={t.messages} audience="AUTHOR" />
        <FollowUp ticketId={t.id} closed={closed} />
      </Card>
    </div>
  );
}
