import type { ChatSession } from '@bookleaf/shared';
import { Fragment, useEffect, useRef } from 'react';
import { useInitialQuestion } from '../../lib/useInitialQuestion';
import { errorMessage } from '../../lib/api';
import type { MessageQueue, QueuedMessage } from '../../lib/chatQueue';
import { useChat } from '../../lib/useChat';
import { ChatBubble } from '../molecules/ChatBubble';
import { ChatComposer } from '../molecules/ChatComposer';
import { ChatWelcome } from '../molecules/ChatWelcome';
import { QueuedBubble } from '../molecules/QueuedBubble';
import { ErrorState, LoadingState } from '../molecules/States';
import { TicketSentNote } from '../molecules/TicketSentNote';
import { TypingBubble } from '../molecules/TypingBubble';

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

function RestartError({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-[12.5px] text-danger">
      Could not start a new conversation. {errorMessage(error)}
    </p>
  );
}

function Conversation({ chat, maxChars }: { chat: Chat; maxChars: number }) {
  const { session, queue, queued, restart } = chat;
  const endRef = useRef<HTMLDivElement>(null);
  const messages = session?.messages ?? [];
  const count = messages.length;
  // Block body on purpose: an effect must not return scrollIntoView's result (newer browsers
  // return a Promise, which React would then try to call as a cleanup function).
  const empty = count === 0 && queued.length === 0;
  useEffect(() => {
    // Nothing to follow in an empty chat: keep the header and the welcome in view.
    if (!empty) endRef.current?.scrollIntoView({ block: 'end' });
  }, [empty, count, queued]);
  const ask = (question: string) => queue.add(question);
  return (
    <div className="flex flex-1 flex-col gap-4">
      <ol className="flex flex-col gap-4" aria-live="polite" aria-label="Conversation">
        {empty ? <ChatWelcome onAsk={ask} /> : null}
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
        canRestart={count > 0 || queued.length > 0}
        onSend={ask}
        onRestart={() => restart.mutate()}
      />
      <RestartError error={restart.error} />
      {/* After the pinned composer, so scrolling here never leaves content hidden under it. */}
      <div ref={endRef} />
    </div>
  );
}

interface Props {
  maxChars: number;
  /** Called once a new conversation has started, so the page can reset what belongs to the old one. */
  onRestarted?: () => void;
}

export function ChatPanel({ maxChars, onRestarted }: Props) {
  const chat = useChat(true, onRestarted);
  const { current } = chat;
  useInitialQuestion(current.isSuccess, chat.queue);
  if (current.isPending) return <LoadingState label="Opening chat…" />;
  if (current.isError)
    return (
      <ErrorState message={errorMessage(current.error)} onRetry={() => void current.refetch()} />
    );
  return <Conversation chat={chat} maxChars={maxChars} />;
}
