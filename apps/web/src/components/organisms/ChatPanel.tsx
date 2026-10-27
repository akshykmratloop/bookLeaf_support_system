import { Fragment, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../../lib/api';
import { useChat } from '../../lib/useChat';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { ChatBubble } from '../molecules/ChatBubble';
import { ChatComposer } from '../molecules/ChatComposer';
import { QueuedBubble } from '../molecules/QueuedBubble';
import { ErrorState, LoadingState } from '../molecules/States';
import { TypingBubble } from '../molecules/TypingBubble';

const SUGGESTIONS = [
  'How much royalty is pending on my books?',
  'When is the next payout?',
  'What stage is my book in?',
];

export function ChatPanel({ maxChars }: { maxChars: number }) {
  const { current, session, queue, queued, restart } = useChat(true);
  const endRef = useRef<HTMLDivElement>(null);
  const messages = session?.messages ?? [];
  const count = messages.length;
  // Block body on purpose: an effect must not return scrollIntoView's result (newer browsers
  // return a Promise, which React would then try to call as a cleanup function).
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [count, queued]);

  if (current.isPending) return <LoadingState label="Opening chat…" />;
  if (current.isError)
    return (
      <ErrorState message={errorMessage(current.error)} onRetry={() => void current.refetch()} />
    );

  const ask = (question: string) => queue.add(question);

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3" aria-live="polite" aria-label="Conversation">
        {count === 0 && queued.length === 0 ? (
          <li className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Button key={s} variant="secondary" size="sm" onClick={() => ask(s)}>
                {s}
              </Button>
            ))}
          </li>
        ) : null}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        {queued.map((item) => (
          <Fragment key={item.localId}>
            <QueuedBubble
              item={item}
              onRetry={() => queue.retry(item.localId)}
              onRemove={() => queue.remove(item.localId)}
            />
            {item.status === 'sending' ? <TypingBubble /> : null}
          </Fragment>
        ))}
      </ol>
      {session?.ticket ? (
        <Card className="p-3 text-[13px]">
          Ticket{' '}
          <Link className="font-semibold text-brand underline" to={`/tickets/${session.ticket.id}`}>
            {session.ticket.number}
          </Link>{' '}
          was raised from this conversation. The team will reply there.
        </Card>
      ) : null}
      <ChatComposer
        maxChars={maxChars}
        usedTurns={session ? session.turnCount + queued.length : queued.length || null}
        maxTurns={session?.maxTurns ?? null}
        isRestarting={restart.isPending}
        onSend={ask}
        onRestart={() => restart.mutate()}
      />
      {/* After the pinned composer, so scrolling here never leaves content hidden under it. */}
      <div ref={endRef} />
    </div>
  );
}
