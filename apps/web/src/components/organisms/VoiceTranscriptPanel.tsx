import { Phone } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../../lib/api';
import { useAdminVoiceCall } from '../../lib/assistant';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { ChatBubble } from '../molecules/ChatBubble';
import { ErrorState, LoadingState } from '../molecules/States';

/** For tickets raised from a voice call: what was said, plus the spoken-figures check. */
export function VoiceTranscriptPanel({ callId }: { callId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const call = useAdminVoiceCall(isOpen ? callId : null);
  const issues = call.data?.spokenCheck?.issues ?? [];
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
      {isOpen && call.isPending ? <LoadingState label="Loading call…" /> : null}
      {isOpen && call.isError ? <ErrorState message={errorMessage(call.error)} /> : null}
      {isOpen && issues.length ? (
        <div role="note" className="mt-3 rounded-md bg-warning-bg p-3 text-[12.5px]">
          <p className="font-semibold">Check before replying: the assistant may have said</p>
          <ul className="mt-1 list-disc pl-5">
            {issues.map((i) => (
              <li key={i.code + i.message}>{i.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {isOpen && call.data ? (
        <ol className="mt-4 flex flex-col gap-3">
          {call.data.transcript.map((l, i) => (
            <ChatBubble
              key={`${l.at}-${i}`}
              message={{ role: l.role, body: l.text, source: null, factsUsed: [] }}
            />
          ))}
        </ol>
      ) : null}
    </Card>
  );
}
