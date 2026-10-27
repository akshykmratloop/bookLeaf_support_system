import { Link } from 'react-router';
import { Card } from '../../components/atoms/Card';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { ChatPanel } from '../../components/organisms/ChatPanel';
import { VoiceCallPanel } from '../../components/organisms/VoiceCallPanel';
import { errorMessage } from '../../lib/api';
import { useAssistantAvailability } from '../../lib/assistant';

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

export function AssistantPage() {
  const availability = useAssistantAvailability();
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
  return (
    <div className="max-w-[820px]">
      <PageHeader
        title="Ask BookLeaf"
        subtitle="Quick answers from your own book and royalty records. For anything that needs action, raise a ticket."
      />
      {chat.state === 'DISABLED' ? (
        <EmptyState
          title="Chat is switched off"
          body="The BookLeaf team has turned off chat for now. You can raise a ticket instead."
        />
      ) : chat.state === 'AVAILABLE' ? (
        <ChatPanel maxChars={chat.maxMessageChars} />
      ) : (
        <Unavailable channel="Chat" />
      )}
      {voice.state === 'DISABLED' ? null : (
        <section className="mt-6" aria-label="Voice call">
          {voice.state === 'AVAILABLE' ? (
            <VoiceCallPanel maxSeconds={voice.maxCallSeconds} callsPerHour={voice.callsPerHour} />
          ) : (
            <Unavailable channel="Voice calls" />
          )}
        </section>
      )}
    </div>
  );
}
