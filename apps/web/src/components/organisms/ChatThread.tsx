import type { ChatMessage } from '@bookleaf/shared';
import { Fragment } from 'react';
import { chatLine, threadItems } from '../../lib/callGroups';
import type { MessageQueue, QueuedMessage } from '../../lib/chatQueue';
import { liveCallLines } from '../../lib/voice/liveLines';
import type { CallView } from '../../lib/voice/view';
import { CallDivider, savedCallLabel } from '../molecules/CallDivider';
import { ChatBubble } from '../molecules/ChatBubble';
import { QueuedBubble } from '../molecules/QueuedBubble';
import { TypingBubble } from '../molecules/TypingBubble';

/** Messages typed while an answer is on its way, sent one at a time. */
export function QueuedList({
  queue,
  queued,
}: {
  queue: MessageQueue;
  queued: readonly QueuedMessage[];
}) {
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

/** Typed and spoken messages in order, with a divider where each call joined. */
export function SavedThread({ messages }: { messages: readonly ChatMessage[] }) {
  return threadItems(messages, chatLine).map((item) =>
    item.kind === 'call' ? (
      <CallDivider key={`call-${item.callId}`} label={savedCallLabel(item.minutes, item.at)} />
    ) : (
      <ChatBubble key={item.message.id} message={item.message} />
    ),
  );
}

/** What is being said on the current call, until the chat has saved it. */
export function LiveCallThread({
  view,
  messages,
}: {
  view: CallView;
  messages: readonly ChatMessage[];
}) {
  const lines = liveCallLines(view, messages);
  const started = view.phase === 'live' || view.phase === 'ending' || lines.length > 0;
  if (!view.callId || !started) return null;
  return (
    <>
      <CallDivider label={view.phase === 'live' ? 'Call · now' : 'Call'} />
      {lines.map((l, i) => (
        <ChatBubble
          key={`live-${i}`}
          message={{ role: l.role, body: l.text, source: null, factsUsed: [], channel: 'VOICE' }}
        />
      ))}
    </>
  );
}
