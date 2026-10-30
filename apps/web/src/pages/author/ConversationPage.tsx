import type { ConversationDetail, ConversationKind } from '@bookleaf/shared';
import { ArrowLeft } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router';
import { Card } from '../../components/atoms/Card';
import { DraftSummary } from '../../components/molecules/DraftSummary';
import { PageHeader } from '../../components/molecules/PageHeader';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { TranscriptList } from '../../components/molecules/TranscriptList';
import { kindOf, useConversation } from '../../lib/conversations';
import { shouldShowTicket } from '../../lib/ticketVisibility';
import { dateTime } from '../../lib/format';
import { authorPaths } from '../../lib/paths';

const backLink = (
  <Link to={authorPaths.history} className="inline-flex items-center gap-1 text-[13px] text-ink-2">
    <ArrowLeft size={14} aria-hidden /> All conversations
  </Link>
);

function Body({ conversation: c }: { conversation: ConversationDetail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-4">
        <TranscriptList lines={c.lines} className="flex flex-col gap-3" label="Conversation" />
      </Card>
      {c.draft && shouldShowTicket(c.draft, { opened: false }) ? (
        <DraftSummary draft={c.draft} />
      ) : null}
    </div>
  );
}

function Conversation({ kind, id }: { kind: ConversationKind; id: string }) {
  const query = useConversation(kind, id);
  const title = kind === 'CALL' ? 'Past call' : 'Past chat';
  const subtitle = query.data ? `${dateTime(query.data.startedAt)} · read-only` : undefined;
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={backLink} />
      {query.isPending ? <LoadingState label="Loading the conversation…" /> : null}
      {query.isError ? <ErrorState error={query.error} /> : null}
      {query.data ? <Body conversation={query.data} /> : null}
    </>
  );
}

/** A past chat or call, read-only: every line in order and the ticket it prepared. */
export function ConversationPage() {
  const { kind: segment, id } = useParams();
  const kind = kindOf(segment);
  if (!kind || !id) return <Navigate to={authorPaths.history} replace />;
  return <Conversation key={`${kind}-${id}`} kind={kind} id={id} />;
}
