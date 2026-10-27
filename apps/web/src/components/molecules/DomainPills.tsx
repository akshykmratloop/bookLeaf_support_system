import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type AiState,
  type FieldSource,
  type Priority,
  type TicketCategory,
  type TicketStatus,
} from '@bookleaf/shared';
import { Pill, type Tone } from '../atoms/Pill';

const STATUS_TONE: Record<TicketStatus, Tone> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};
const PRIORITY_TONE: Record<Priority, Tone> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'neutral',
};

export const StatusPill = ({ status }: { status: TicketStatus }) => (
  <Pill tone={STATUS_TONE[status]} dot>
    {STATUS_LABELS[status]}
  </Pill>
);

export const PriorityPill = ({ priority }: { priority: Priority }) => (
  <Pill tone={PRIORITY_TONE[priority]}>{PRIORITY_LABELS[priority]}</Pill>
);

const SOURCE_TEXT: Record<FieldSource, string> = {
  AI: 'Set by AI',
  RULES: 'Set by rules (AI unavailable)',
  ADMIN: 'Set by an admin',
};

export function CategoryLabel({
  category,
  source,
}: {
  category: TicketCategory | null;
  source: FieldSource | null;
}) {
  if (!category) return <span className="text-[12.5px] text-ink-3">Classifying…</span>;
  return (
    <span className="text-[12.5px] text-ink-2" title={source ? SOURCE_TEXT[source] : undefined}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

/** AI badges: what an operator needs to know at a glance. */
export function AiBadge({ state, needsReview }: { state: AiState; needsReview: boolean }) {
  if (state === 'PENDING')
    return (
      <Pill tone="neutral" title="AI is classifying this ticket">
        AI pending
      </Pill>
    );
  if (state === 'FALLBACK')
    return (
      <Pill tone="warning" title="AI was unavailable; rules were used">
        Auto-fallback
      </Pill>
    );
  return needsReview ? (
    <Pill tone="accent" title="AI was unsure or rules changed its result">
      Review suggested
    </Pill>
  ) : null;
}
