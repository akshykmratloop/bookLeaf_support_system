import type { TicketDraft } from '@bookleaf/shared';
import { Link } from 'react-router';
import { Card } from '../../components/atoms/Card';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { ChatPanel } from '../../components/organisms/ChatPanel';
import { TicketDraftPanel } from '../../components/organisms/TicketDraftPanel';
import { VoiceCallPanel } from '../../components/organisms/VoiceCallPanel';
import { errorMessage } from '../../lib/api';
import { useAssistantAvailability } from '../../lib/assistant';
import { useChatDraft } from '../../lib/useChatDraft';
import { useVoiceCall } from '../../lib/voice/useVoiceCall';

function Unavailable({ channel }: { channel: 'Chat' | 'Voice calls' }) {
  return (
    <Card className="p-5 text-[13.5px]">
      <p className="font-semibold">
        {channel} {channel === 'Chat' ? 'is' : 'are'} unavailable right now.
      </p>
      <p className="mt-1 text-ink-2">
        You can still{' '}
        <Link to="/tickets/new" className="font-semibold text-brand underline">
          raise a ticket
        </Link>{' '}
        and the support team will reply.
      </p>
    </Card>
  );
}

/**
 * The ticket beside the conversation: the call's draft while a call is on (or just ended),
 * otherwise the current chat conversation's draft.
 */
function DraftAside({ chatOn, callDraft }: { chatOn: boolean; callDraft: TicketDraft | null }) {
  const chat = useChatDraft(chatOn);
  const fromCall = callDraft !== null;
  return (
    <aside className="lg:sticky lg:top-0 lg:self-start" aria-label="Ticket">
      <TicketDraftPanel
        key={fromCall ? `call-${callDraft.id}` : `chat-${chat.draft?.id ?? 'none'}`}
        draft={fromCall ? callDraft : chat.draft}
        origin={fromCall ? 'call' : 'chat'}
        onSaved={fromCall ? () => undefined : chat.onSaved}
        onStart={!fromCall && chatOn ? () => chat.start.mutate() : undefined}
        isStarting={chat.start.isPending}
      />
    </aside>
  );
}

export function AssistantPage() {
  const availability = useAssistantAvailability();
  const call = useVoiceCall();
  if (availability.isPending) return <LoadingState />;
  // A failed background refresh keeps the last answer, so a live call is never unmounted by it.
  if (!availability.data)
    return (
      <ErrorState
        message={errorMessage(availability.error)}
        onRetry={() => void availability.refetch()}
      />
    );
  const { chat, voice } = availability.data;
  const callDraft = call.view.phase === 'idle' ? null : call.view.draft;
  return (
    <div>
      <PageHeader
        title="Ask BookLeaf"
        subtitle="Quick answers from your own book and royalty records. For anything that needs action, raise a ticket."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {chat.state === 'DISABLED' ? (
            <EmptyState
              title="Chat is switched off"
              body="The BookLeaf team has turned off chat for now. You can raise a ticket instead."
            />
          ) : chat.state === 'AVAILABLE' ? (
            <ChatPanel maxChars={chat.maxMessageChars} onRestarted={call.reset} />
          ) : (
            <Unavailable channel="Chat" />
          )}
          {voice.state === 'DISABLED' ? null : (
            <section aria-label="Voice call">
              {voice.state === 'AVAILABLE' ? (
                <VoiceCallPanel
                  call={call}
                  maxSeconds={voice.maxCallSeconds}
                  callsPerHour={voice.callsPerHour}
                />
              ) : (
                <Unavailable channel="Voice calls" />
              )}
            </section>
          )}
        </div>
        <DraftAside chatOn={chat.state === 'AVAILABLE'} callDraft={callDraft} />
      </div>
    </div>
  );
}
