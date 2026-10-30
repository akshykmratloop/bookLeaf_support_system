import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_STATUSES,
  type AdminTicket,
  type AuthUser,
  type FieldSource,
  type UpdateTicketRequest,
} from '@bookleaf/shared';
import { UserCheck } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Dropdown } from '../molecules/Dropdown';
import { BulletList, PropertyRow } from '../molecules/PropertyRow';
import { AiProcessing } from './AiProcessing';
import { optionsWith, useCategoryOptions } from '../../lib/categories';

type Patch = Omit<UpdateTicketRequest, 'version'>;

const STATUS_OPTIONS = TICKET_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));

const SOURCE: Record<FieldSource, string> = {
  AI: 'AI suggestion',
  RULES: 'Rules (AI unavailable)',
  ADMIN: 'Set by admin',
  AUTHOR: 'Chosen by author',
};

interface RowProps {
  ticket: AdminTicket;
  isSaving: boolean;
  onPatch: (patch: Patch) => void;
}

function StatusRow({ ticket, isSaving, onPatch }: RowProps) {
  return (
    <PropertyRow label="Status">
      <Dropdown
        id="ticket-status"
        name="status"
        aria-label="Status"
        value={ticket.status}
        disabled={isSaving}
        options={STATUS_OPTIONS}
        onChange={(status) => onPatch({ status })}
      />
    </PropertyRow>
  );
}

function CategoryRow({ ticket, isSaving, onPatch }: RowProps) {
  const options = optionsWith(useCategoryOptions().data, ticket.category, ticket.categoryLabel);
  return (
    <PropertyRow
      label="Category"
      hint={ticket.categorySource ? SOURCE[ticket.categorySource] : 'Waiting for AI'}
    >
      <Dropdown
        id="ticket-category"
        name="category"
        aria-label="Category"
        value={ticket.category ?? ''}
        disabled={isSaving}
        placeholder="Classifying…"
        options={options.map((c) => ({ value: c.key, label: c.label }))}
        onChange={(category) => onPatch({ category })}
      />
    </PropertyRow>
  );
}

function PriorityRow({ ticket, isSaving, onPatch }: RowProps) {
  return (
    <PropertyRow label="Priority" hint={SOURCE[ticket.prioritySource]}>
      <Dropdown
        id="ticket-priority"
        name="priority"
        aria-label="Priority"
        value={ticket.priority}
        disabled={isSaving}
        options={PRIORITY_OPTIONS}
        onChange={(priority) => onPatch({ priority })}
      />
      <BulletList items={ticket.priorityReasons} />
    </PropertyRow>
  );
}

function AssigneeRow({ ticket, isSaving, onPatch, user }: RowProps & { user: AuthUser }) {
  const mine = ticket.assignee?.id === user.id;
  return (
    <PropertyRow label="Assignee">
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
    </PropertyRow>
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
export function TicketProperties({ user, onRetryAi, isRetrying, ...row }: Props) {
  return (
    <Card className="flex flex-col gap-4 p-4">
      <StatusRow {...row} />
      <CategoryRow {...row} />
      <PriorityRow {...row} />
      {row.ticket.needsInfo.length ? (
        <PropertyRow label="Check before replying">
          <BulletList items={row.ticket.needsInfo} />
        </PropertyRow>
      ) : null}
      <AssigneeRow {...row} user={user} />
      <AiProcessing ticket={row.ticket} onRetry={onRetryAi} isRetrying={isRetrying} />
    </Card>
  );
}
