import type { AdminVoiceCall } from '@bookleaf/shared';
import { Phone } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../../lib/api';
import { useAdminVoiceCall } from '../../lib/assistant';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { ErrorState, LoadingState } from '../molecules/States';
import { TranscriptList } from '../molecules/TranscriptList';

type SpokenIssue = NonNullable<AdminVoiceCall['spokenCheck']>['issues'][number];

/** Figures the assistant said that the records did not confirm. */
function SpokenIssues({ issues }: { issues: readonly SpokenIssue[] }) {
  if (!issues.length) return null;
  return (
    <div role="note" className="mt-3 rounded-md bg-warning-bg p-3 text-[12.5px]">
      <p className="font-semibold">Check before replying: the assistant may have said</p>
      <ul className="mt-1 list-disc pl-5">
        {issues.map((i) => (
          <li key={i.code + i.message}>{i.message}</li>
        ))}
      </ul>
    </div>
  );
}

function CallBody({ callId }: { callId: string }) {
  const call = useAdminVoiceCall(callId);
  if (call.isPending) return <LoadingState label="Loading call…" />;
  if (call.isError) return <ErrorState message={errorMessage(call.error)} />;
  return (
    <>
      <SpokenIssues issues={call.data.spokenCheck?.issues ?? []} />
      <TranscriptList lines={call.data.transcript} className="mt-4 flex flex-col gap-3" />
    </>
  );
}

/** For tickets raised from a voice call: what was said, plus the spoken-figures check. */
export function VoiceTranscriptPanel({ callId }: { callId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <Phone size={15} aria-hidden /> Raised from a voice call
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
        >
          {isOpen ? 'Hide call' : 'Show call'}
        </Button>
      </div>
      {isOpen ? <CallBody callId={callId} /> : null}
    </Card>
  );
}
