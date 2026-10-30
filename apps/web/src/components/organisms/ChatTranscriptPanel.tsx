import { MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import { useChatTranscript } from '../../lib/assistant';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { ChatBubble } from '../molecules/ChatBubble';
import { ErrorState, LoadingState } from '../molecules/States';

/** For tickets raised from chat: the conversation that led to it, loaded on demand. */
export function ChatTranscriptPanel({ sessionId }: { sessionId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const transcript = useChatTranscript(isOpen ? sessionId : null);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <MessagesSquare size={15} aria-hidden /> Raised from Ask BookLeaf chat
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
        >
          {isOpen ? 'Hide conversation' : 'Show conversation'}
        </Button>
      </div>
      {isOpen && transcript.isPending ? <LoadingState label="Loading conversation…" /> : null}
      {isOpen && transcript.isError ? <ErrorState error={transcript.error} /> : null}
      {isOpen && transcript.data ? (
        <ol className="mt-4 flex flex-col gap-3">
          {transcript.data.messages.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))}
        </ol>
      ) : null}
    </Card>
  );
}
