import {
  CATEGORY_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type AdminTicket,
  type AuthUser,
  type FieldSource,
  type UpdateTicketRequest,
} from '@bookleaf/shared';
import { RefreshCw, UserCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Select } from '../atoms/Input';

type Patch = Omit<UpdateTicketRequest, 'version'>;

const SOURCE: Record<FieldSource, string> = {
  AI: 'AI suggestion',
  RULES: 'Rules (AI unavailable)',
  ADMIN: 'Set by admin',
  AUTHOR: 'Chosen by author',
};
const JOB_TEXT: Record<string, string> = {
  QUEUED: 'Queued',
  RUNNING: 'Running',
  SUCCEEDED: 'Done',
  FALLBACK: 'Fell back to rules',
};

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11.5px] font-semibold text-ink-3 uppercase">{label}</span>
      {children}
      {hint ? <span className="text-[11.5px] text-ink-3">{hint}</span> : null}
    </div>
  );
}

function AiStatus({
  ticket,
  onRetry,
  isRetrying,
}: {
  ticket: AdminTicket;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <Row label="AI processing">
      <ul className="flex flex-col gap-1 text-[12.5px] text-ink-2">
        {ticket.aiJobs.map((j) => (
          <li key={j.kind}>
            {j.kind === 'TRIAGE' ? 'Classification' : 'Draft'}: {JOB_TEXT[j.status] ?? j.status}
            {j.status === 'QUEUED' && j.attempts > 0
              ? ` (retry ${j.attempts + 1} of ${j.maxAttempts})`
              : ''}
            {j.lastErrorCode && j.status !== 'SUCCEEDED' ? (
              <span className="text-ink-3"> · {j.lastErrorCode}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={onRetry}
        isLoading={isRetrying}
        icon={<RefreshCw size={13} aria-hidden />}
      >
        Re-run AI classification
      </Button>
    </Row>
  );
}

interface Props {
  ticket: AdminTicket;
  user: AuthUser;
  isSaving: boolean;
  onPatch: (patch: Patch) => void;
  onRetryAi: () => void;
  isRetrying: boolean;
}

/** Every AI decision is shown with its source and can be overridden; overrides are never undone by AI. */
export function TicketProperties({
  ticket,
  user,
  isSaving,
  onPatch,
  onRetryAi,
  isRetrying,
}: Props) {
  const mine = ticket.assignee?.id === user.id;
  return (
    <Card className="flex flex-col gap-4 p-4">
      <Row label="Status">
        <Select
          aria-label="Status"
          value={ticket.status}
          disabled={isSaving}
          onChange={(e) => onPatch({ status: e.target.value as AdminTicket['status'] })}
        >
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </Row>
      <Row
        label="Category"
        hint={ticket.categorySource ? SOURCE[ticket.categorySource] : 'Waiting for AI'}
      >
        <Select
          aria-label="Category"
          value={ticket.category ?? ''}
          disabled={isSaving}
          onChange={(e) =>
            onPatch({ category: e.target.value as NonNullable<AdminTicket['category']> })
          }
        >
          {ticket.category ? null : <option value="">Classifying…</option>}
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </Row>
      <Row label="Priority" hint={SOURCE[ticket.prioritySource]}>
        <Select
          aria-label="Priority"
          value={ticket.priority}
          disabled={isSaving}
          onChange={(e) => onPatch({ priority: e.target.value as AdminTicket['priority'] })}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
        {ticket.priorityReasons.length ? (
          <ul className="list-disc pl-4 text-[12px] text-ink-2">
            {ticket.priorityReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}
      </Row>
      {ticket.needsInfo.length ? (
        <Row label="Check before replying">
          <ul className="list-disc pl-4 text-[12px] text-ink-2">
            {ticket.needsInfo.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Row>
      ) : null}
      <Row label="Assignee">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px]">{ticket.assignee?.name ?? 'Unassigned'}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={isSaving}
            onClick={() => onPatch({ assigneeId: mine ? null : user.id })}
            icon={<UserCheck size={13} aria-hidden />}
          >
            {mine ? 'Unassign' : 'Assign to me'}
          </Button>
        </div>
      </Row>
      <AiStatus ticket={ticket} onRetry={onRetryAi} isRetrying={isRetrying} />
    </Card>
  );
}
