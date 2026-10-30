import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Card } from '../../components/atoms/Card';
import { Chip } from '../../components/atoms/Chip';
import { Pill } from '../../components/atoms/Pill';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { StatusStepper } from '../../components/molecules/StatusStepper';
import { SolveTicketCard } from '../../components/organisms/SolveTicketCard';
import { TicketConversation } from '../../components/organisms/TicketConversation';
import { TicketInfoCard } from '../../components/organisms/TicketInfoCard';
import { TicketReplyBox } from '../../components/organisms/TicketReplyBox';
import { categoryStyle } from '../../lib/categoryStyle';
import { authorPaths } from '../../lib/paths';
import { useAuthorTicket } from '../../lib/queries';
import { requesterStatus } from '../../lib/ticketStatus';

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const ticket = useAuthorTicket(id);
  if (ticket.isPending) return <LoadingState label="Loading ticket…" />;
  if (ticket.isError)
    return <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />;
  const t = ticket.data;
  const status = requesterStatus(t);
  const cat = categoryStyle(t.category);
  return (
    <div className="flex flex-col gap-4">
      <Link
        to={authorPaths.tickets}
        className="inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] font-semibold text-ink-2 hover:bg-panel-2 hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden /> All tickets
      </Link>
      <Card className="flex flex-col gap-4 p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[12px] text-ink-3">{t.number}</p>
            <h1 className="text-[19px] leading-snug font-bold break-words lg:text-[22px]">
              {t.subject}
            </h1>
            <div className="mt-2">
              <Chip colors={cat.colors} icon={<cat.Icon size={12} aria-hidden />}>
                {cat.label}
              </Chip>
            </div>
          </div>
          <Pill tone={status.tone} dot>
            {status.label}
          </Pill>
        </div>
        <StatusStepper status={status} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-w-0 flex-col gap-5" aria-label="Messages">
          <TicketConversation
            description={t.description}
            createdAt={t.createdAt}
            messages={t.messages}
          />
          <TicketReplyBox ticketId={t.id} closed={!t.canSolve} />
        </section>
        <aside className="flex flex-col gap-4">
          {t.canSolve ? <SolveTicketCard ticketId={t.id} /> : null}
          <TicketInfoCard ticket={t} />
        </aside>
      </div>
    </div>
  );
}
