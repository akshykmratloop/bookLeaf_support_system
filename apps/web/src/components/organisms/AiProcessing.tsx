import type { AdminTicket } from '@bookleaf/shared';
import { RefreshCw } from 'lucide-react';
import { Button } from '../atoms/Button';
import { PropertyRow } from '../molecules/PropertyRow';

const JOB_TEXT: Record<string, string> = {
  QUEUED: 'Queued',
  RUNNING: 'Running',
  SUCCEEDED: 'Done',
  FALLBACK: 'Fell back to rules',
  FAILED: 'AI failed — write the reply yourself',
};

/** The ticket's AI jobs and their state, with a button to run classification again. */
export function AiProcessing({
  ticket,
  onRetry,
  isRetrying,
}: {
  ticket: AdminTicket;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <PropertyRow label="AI processing">
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
    </PropertyRow>
  );
}
