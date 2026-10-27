import type { ChatMessage } from '@bookleaf/shared';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../../lib/api';
import { useBooks } from '../../lib/queries';
import { useChat } from '../../lib/useChat';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { ChatBubble } from '../molecules/ChatBubble';
import { ChatComposer } from '../molecules/ChatComposer';
import { QueuedBubble } from '../molecules/QueuedBubble';
import { ErrorState, LoadingState } from '../molecules/States';
import { useToast } from '../molecules/Toast';
import { TypingBubble } from '../molecules/TypingBubble';
import { ChatTicketCard } from './ChatTicketCard';

const SUGGESTIONS = [
  'How much royalty is pending on my books?',
  'When is the next payout?',
  'What stage is my book in?',
];

const lastAnswer = (messages: ChatMessage[]) =>
  [...messages].reverse().find((m) => m.role === 'ASSISTANT') ?? null;

export function ChatPanel({ maxChars }: { maxChars: number }) {
  const toast = useToast();
  const books = useBooks();
  const { current, session, queue, queued, restart, raise } = useChat(true);
  const [dismissed, setDismissed] = useState<string | null>(null);
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
  const answer = lastAnswer(messages);
  const proposal =
    answer?.proposal && !session?.ticket && dismissed !== answer.id ? answer.proposal : null;

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
      {proposal && answer && queued.length === 0 ? (
        <ChatTicketCard
          key={answer.id}
          proposal={proposal}
          books={books.data ?? []}
          isSubmitting={raise.isPending}
          onDismiss={() => setDismissed(answer.id)}
          onConfirm={(v) =>
            raise.mutate(v, {
              onSuccess: (t) => toast('success', `Ticket ${t.number} raised`),
              onError: (e) => toast('error', errorMessage(e)),
            })
          }
        />
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
