import type { AdminTicket, UpdateTicketRequest } from '@bookleaf/shared';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useUser } from '../../app/AuthedLayout';
import { Card } from '../../components/atoms/Card';
import { AiBadge, PriorityPill, StatusPill } from '../../components/molecules/DomainPills';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { ChatTranscriptPanel } from '../../components/organisms/ChatTranscriptPanel';
import { VoiceTranscriptPanel } from '../../components/organisms/VoiceTranscriptPanel';
import { EvidencePanel } from '../../components/organisms/EvidencePanel';
import { MessageThread } from '../../components/organisms/MessageThread';
import { ReplyComposer } from '../../components/organisms/ReplyComposer';
import { TicketProperties } from '../../components/organisms/TicketProperties';
import { api, errorMessage } from '../../lib/api';
import { dateTime, sla } from '../../lib/format';
import { keys, useAdminTicket, useApiMutation, useDraft } from '../../lib/queries';

type Patch = Omit<UpdateTicketRequest, 'version'>;

function Header({ t }: { t: AdminTicket }) {
  const s = sla(t.slaDueAt, t.firstResponseAt);
  return (
    <div className="mb-5">
      <Link
        to="/admin"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden /> Queue
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[12px] text-ink-3">{t.number}</span>
        <StatusPill status={t.status} />
        <PriorityPill priority={t.priority} />
        <AiBadge state={t.aiState} needsReview={t.needsReview} />
        <span className={`text-[12px] ${s.overdue ? 'font-semibold text-danger' : 'text-ink-3'}`}>
          First response: {s.text}
        </span>
      </div>
      <h1 className="mt-1 text-[22px] font-semibold break-words">{t.subject}</h1>
      <p className="text-[12.5px] text-ink-3">
        {t.author.name} · {t.book?.title ?? 'General / Account level'} · opened{' '}
        {dateTime(t.createdAt)}
      </p>
    </div>
  );
}

/** The chat or call the ticket came from, if any. */
function SourcePanel({ t }: { t: AdminTicket }) {
  if (t.source === 'CHAT' && t.chatSessionId)
    return <ChatTranscriptPanel sessionId={t.chatSessionId} />;
  if (t.source === 'VOICE' && t.voiceSessionId)
    return <VoiceTranscriptPanel callId={t.voiceSessionId} />;
  return null;
}

/** Admin actions on one ticket; each refreshes what it changes. */
function useTicketActions(id: string) {
  const refresh = [keys.ticket(id), keys.tickets(), keys.draft(id)];
  const patch = useApiMutation(
    (p: Patch & { version: number }) =>
      api<AdminTicket>(`/tickets/${id}`, { method: 'PATCH', body: p }),
    refresh,
  );
  const retry = useApiMutation(
    () => api<AdminTicket>(`/tickets/${id}/ai/retry`, { method: 'POST' }),
    refresh,
  );
  const regenerate = useApiMutation(
    () => api(`/tickets/${id}/draft/regenerate`, { method: 'POST' }),
    [keys.draft(id)],
  );
  return { patch, retry, regenerate };
}

function Workspace({ t, draft }: { t: AdminTicket; draft: ReturnType<typeof useDraft> }) {
  const user = useUser();
  const toast = useToast();
  const { patch, retry, regenerate } = useTicketActions(t.id);
  const onError = (err: unknown) => toast('error', errorMessage(err));
  const onPatch = (p: Patch) =>
    patch.mutate(
      { ...p, version: t.version },
      { onSuccess: () => toast('success', 'Ticket updated'), onError },
    );
  const current = draft.data?.draft ?? null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <SourcePanel t={t} />
        <Card className="p-4">
          <MessageThread description={t.description} messages={t.messages} audience="ADMIN" />
        </Card>
        <ReplyComposer
          ticketId={t.id}
          draft={current}
          isDraftPending={draft.data?.pending ?? draft.isPending}
          onRegenerate={() => regenerate.mutate(undefined, { onError })}
          isRegenerating={regenerate.isPending}
        />
      </div>
      <div className="flex flex-col gap-4">
        <TicketProperties
          ticket={t}
          user={user}
          isSaving={patch.isPending}
          onPatch={onPatch}
          onRetryAi={() => retry.mutate(undefined, { onError })}
          isRetrying={retry.isPending}
        />
        {current ? <EvidencePanel facts={current.facts} /> : null}
      </div>
    </div>
  );
}

export function TicketWorkspacePage() {
  const { id = '' } = useParams();
  const ticket = useAdminTicket(id);
  // Loaded alongside the ticket, not after it.
  const draft = useDraft(id);
  if (ticket.isPending) return <LoadingState label="Loading ticket…" />;
  if (ticket.isError)
    return (
      <ErrorState message={errorMessage(ticket.error)} onRetry={() => void ticket.refetch()} />
    );
  return (
    <>
      <Header t={ticket.data} />
      <Workspace t={ticket.data} draft={draft} />
    </>
  );
}
