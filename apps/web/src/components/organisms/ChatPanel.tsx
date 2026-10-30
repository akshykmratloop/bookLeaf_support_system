import { useEffect, useRef } from 'react';
import { useInitialQuestion } from '../../lib/useInitialQuestion';
import { errorMessage } from '../../lib/api';
import { useChat } from '../../lib/useChat';
import type { CallView } from '../../lib/voice/view';
import { ChatWelcome } from '../molecules/ChatWelcome';
import { ErrorState, LoadingState } from '../molecules/States';
import { TicketSentNote } from '../molecules/TicketSentNote';
import { ChatFooter, type CallInChat } from './ChatFooter';
import { LiveCallThread, QueuedList, SavedThread } from './ChatThread';

export type { CallInChat } from './ChatFooter';

type Chat = ReturnType<typeof useChat>;

/**
 * Keeps the newest line in view as messages, queued questions and call lines arrive. An empty
 * chat is left alone so the header and the welcome stay in view.
 */
function useFollowEnd(count: number, queued: Chat['queued'], callView?: CallView) {
  const endRef = useRef<HTMLDivElement>(null);
  const live = callView ? callView.lines.length : 0;
  const empty = count === 0 && queued.length === 0 && live === 0;
  // Block body on purpose: an effect must not return scrollIntoView's result (newer browsers
  // return a Promise, which React would then try to call as a cleanup function).
  useEffect(() => {
    if (!empty) endRef.current?.scrollIntoView({ block: 'end' });
  }, [empty, count, queued, live, callView?.phase]);
  return { endRef, empty };
}

function RestartError({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-[12.5px] text-danger">
      Could not start a new conversation. {errorMessage(error)}
    </p>
  );
}

function Conversation({
  chat,
  maxChars,
  call,
}: {
  chat: Chat;
  maxChars: number;
  call?: CallInChat;
}) {
  const { session, queue, queued, restart } = chat;
  const messages = session?.messages ?? [];
  const callView = call?.controls.view;
  const { endRef, empty } = useFollowEnd(messages.length, queued, callView);
  const ask = (question: string) => queue.add(question);
  return (
    <div className="flex flex-1 flex-col gap-4">
      <ol className="flex flex-col gap-4" aria-live="polite" aria-label="Conversation">
        {empty ? <ChatWelcome onAsk={ask} /> : null}
        <SavedThread messages={messages} />
        {callView ? <LiveCallThread view={callView} messages={messages} /> : null}
        <QueuedList queue={queue} queued={queued} />
      </ol>
      {session?.ticket ? (
        <TicketSentNote ticket={session.ticket}>
          was raised from this conversation. The team will reply there.
        </TicketSentNote>
      ) : null}
      <ChatFooter chat={chat} maxChars={maxChars} call={call} onAsk={ask} />
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
  /** Calls inside this conversation: the chat box's voice button and the live call. */
  call?: CallInChat;
}

export function ChatPanel({ maxChars, onRestarted, call }: Props) {
  const chat = useChat(true, onRestarted);
  const { current } = chat;
  useInitialQuestion(current.isSuccess, chat.queue);
  if (current.isPending) return <LoadingState label="Opening chat…" />;
  if (current.isError)
    return <ErrorState error={current.error} onRetry={() => void current.refetch()} />;
  return <Conversation chat={chat} maxChars={maxChars} call={call} />;
}
