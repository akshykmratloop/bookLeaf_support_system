import type { ChatSession } from '@bookleaf/shared';
import { Fragment, useEffect, useRef } from 'react';
import { errorMessage } from '../../lib/api';
import type { MessageQueue, QueuedMessage } from '../../lib/chatQueue';
import { useChat } from '../../lib/useChat';
import { Button } from '../atoms/Button';
import { ChatBubble } from '../molecules/ChatBubble';
import { ChatComposer } from '../molecules/ChatComposer';
import { QueuedBubble } from '../molecules/QueuedBubble';
import { ErrorState, LoadingState } from '../molecules/States';
import { TicketSentNote } from '../molecules/TicketSentNote';
import { TypingBubble } from '../molecules/TypingBubble';

const SUGGESTIONS = [
  'How much royalty is pending on my books?',
  'When is the next payout?',
  'What stage is my book in?',
];

function Suggestions({ onAsk }: { onAsk: (question: string) => void }) {
  return (
    <li className="flex flex-wrap gap-2">
      {SUGGESTIONS.map((s) => (
        <Button key={s} variant="secondary" size="sm" onClick={() => onAsk(s)}>
          {s}
        </Button>
      ))}
    </li>
  );
}

/** Messages typed while an answer is on its way, sent one at a time. */
function QueuedList({ queue, queued }: { queue: MessageQueue; queued: readonly QueuedMessage[] }) {
  return queued.map((item) => (
    <Fragment key={item.localId}>
      <QueuedBubble
        item={item}
        onRetry={() => queue.retry(item.localId)}
        onRemove={() => queue.remove(item.localId)}
      />
      {item.status === 'sending' ? <TypingBubble /> : null}
    </Fragment>
  ));
}

/** Turns used so far, counting queued messages; null before the first message. */
const usedTurns = (session: ChatSession | null, queuedCount: number) =>
  session ? session.turnCount + queuedCount : queuedCount || null;

type Chat = ReturnType<typeof useChat>;

function Conversation({ chat, maxChars }: { chat: Chat; maxChars: number }) {
  const { session, queue, queued, restart } = chat;
  const endRef = useRef<HTMLDivElement>(null);
  const messages = session?.messages ?? [];
  const count = messages.length;
  // Block body on purpose: an effect must not return scrollIntoView's result (newer browsers
  // return a Promise, which React would then try to call as a cleanup function).
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [count, queued]);
  const ask = (question: string) => queue.add(question);
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3" aria-live="polite" aria-label="Conversation">
        {count === 0 && queued.length === 0 ? <Suggestions onAsk={ask} /> : null}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        <QueuedList queue={queue} queued={queued} />
      </ol>
      {session?.ticket ? (
        <TicketSentNote ticket={session.ticket}>
          was raised from this conversation. The team will reply there.
        </TicketSentNote>
      ) : null}
      <ChatComposer
        maxChars={maxChars}
        usedTurns={usedTurns(session, queued.length)}
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

export function ChatPanel({ maxChars }: { maxChars: number }) {
  const chat = useChat(true);
  const { current } = chat;
  if (current.isPending) return <LoadingState label="Opening chat…" />;
  if (current.isError)
    return (
      <ErrorState message={errorMessage(current.error)} onRetry={() => void current.refetch()} />
    );
  return <Conversation chat={chat} maxChars={maxChars} />;
}
