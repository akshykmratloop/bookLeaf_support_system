import type { ChatSession } from '@bookleaf/shared';
import { callNotice } from '../../lib/voice/endText';
import type { VoiceCallControls } from '../../lib/voice/useVoiceCall';
import type { useChat } from '../../lib/useChat';
import { ChatComposer, type ComposerVoice } from '../molecules/ChatComposer';
import { LimitReached } from '../molecules/LimitReached';
import { ChatCallBar, isCallActive } from './ChatCallBar';

type Chat = ReturnType<typeof useChat>;

/** A call inside this conversation: its controls and the chat box's voice button. */
export interface CallInChat {
  controls: VoiceCallControls;
  /** Absent when voice calls are not available. */
  voice?: ComposerVoice;
  /** A problem starting the call (before it reached the call service). */
  startError: string | null;
}

/** Turns used (counting queued messages, null before the first), the limit, and if it is hit. */
function turnsOf(session: ChatSession | null, queuedCount: number) {
  const used = session ? session.turnCount + queuedCount : queuedCount || null;
  const maxTurns = session?.maxTurns ?? null;
  const full = maxTurns !== null && used !== null && used >= maxTurns;
  const hasMessages = (session?.messages.length ?? 0) > 0 || queuedCount > 0;
  return { used, maxTurns, full, hasMessages };
}

/** How the last call ended, or why it could not start; shown just above the chat box. */
function CallNotice({ call }: { call?: CallInChat }) {
  const notice = call ? callNotice(call.controls.view, call.startError) : null;
  if (!notice) return null;
  return (
    <p
      role={notice.isError ? 'alert' : 'status'}
      className={`px-2 text-[12.5px] ${notice.isError ? 'text-danger' : 'text-ink-2'}`}
    >
      {notice.text}
    </p>
  );
}

interface Props {
  chat: Chat;
  maxChars: number;
  call?: CallInChat;
  onAsk: (text: string) => void;
}

/**
 * The bottom of the conversation: the live call bar during a call, the limit card once the
 * conversation is full, otherwise the chat box (with its voice button).
 */
export function ChatFooter({ chat, maxChars, call, onAsk }: Props) {
  const { session, queued, restart } = chat;
  const { used, maxTurns, full, hasMessages } = turnsOf(session, queued.length);
  const restartNow = () => restart.mutate();
  if (call && isCallActive(call.controls.view.phase)) return <ChatCallBar call={call.controls} />;
  return (
    <>
      <CallNotice call={call} />
      {full && maxTurns !== null ? (
        <LimitReached maxTurns={maxTurns} isRestarting={restart.isPending} onRestart={restartNow} />
      ) : (
        <ChatComposer
          maxChars={maxChars}
          usedTurns={used}
          maxTurns={maxTurns}
          isRestarting={restart.isPending}
          canRestart={hasMessages}
          onSend={onAsk}
          onRestart={restartNow}
          voice={call?.voice}
        />
      )}
    </>
  );
}
