import type { TicketDraft } from '@bookleaf/shared';
import { useCallback, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Card } from '../../components/atoms/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { AskHeader } from '../../components/organisms/AskHeader';
import { ChatPanel } from '../../components/organisms/ChatPanel';
import { DraftSheet } from '../../components/organisms/DraftSheet';
import { TicketDraftPanel } from '../../components/organisms/TicketDraftPanel';
import { VoiceCallPanel } from '../../components/organisms/VoiceCallPanel';
import { errorMessage } from '../../lib/api';
import { useAssistantAvailability } from '../../lib/assistant';
import { authorPaths } from '../../lib/paths';
import { useChatDraft } from '../../lib/useChatDraft';
import { draftHasContent, shouldShowTicket } from '../../lib/ticketVisibility';
import { useMediaQuery, WIDE } from '../../lib/useMediaQuery';
import { useVoiceCall, type VoiceCallControls } from '../../lib/voice/useVoiceCall';

function Unavailable({ channel }: { channel: 'Chat' | 'Voice calls' }) {
  return (
    <Card className="p-5 text-[13.5px]">
      <p className="font-semibold">
        {channel} {channel === 'Chat' ? 'is' : 'are'} unavailable right now.
      </p>
      <p className="mt-1 text-ink-2">
        You can still{' '}
        <Link to={authorPaths.newTicket} className="font-semibold text-brand-ink underline">
          raise a ticket
        </Link>{' '}
        and the support team will reply.
      </p>
    </Card>
  );
}

/**
 * The ticket: the call's draft while a call is on (or just ended), else this chat's draft. It is
 * shown only when there is something in it, or after the author opens it with the Ticket button.
 */
function useTicket(chatOn: boolean, call: VoiceCallControls) {
  const chat = useChatDraft(chatOn);
  const [opened, setOpened] = useState(false);
  const callDraft = call.view.phase === 'idle' ? null : call.view.draft;
  const fromCall = callDraft !== null;
  const draft = fromCall ? callDraft : chat.draft;
  const panel = (
    <TicketDraftPanel
      key={fromCall ? `call-${callDraft.id}` : `chat-${chat.draft?.id ?? 'none'}`}
      draft={draft}
      origin={fromCall ? 'call' : 'chat'}
      onSaved={fromCall ? () => undefined : chat.onSaved}
      onStart={!fromCall && chatOn ? () => chat.start.mutate() : undefined}
      isStarting={chat.start.isPending}
    />
  );
  const open = () => {
    setOpened(true);
    if (!fromCall && !chat.draft && chatOn && !chat.start.isPending) chat.start.mutate();
  };
  const close = () => setOpened(false);
  return { draft, panel, visible: shouldShowTicket(draft, { opened }), open, close };
}

type Availability = NonNullable<ReturnType<typeof useAssistantAvailability>['data']>;

/**
 * The narrow layout's ticket sheet. It also opens by itself when the assistant asks "shall I
 * send it?", until the author closes that version.
 */
function useTicketSheet(draft: TicketDraft | null) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const version = draft?.version ?? null;
  const asking = draft?.status === 'AWAITING_CONFIRMATION' && dismissed !== version;
  const close = useCallback(() => {
    setOpen(false);
    setDismissed(version);
  }, [version]);
  return { isOpen: open || asking, show: () => setOpen(true), close };
}

/** Where the ticket goes: a side column when wide (only if there is one), else a slide-up sheet. */
function TicketSlot(props: {
  wide: boolean;
  visible: boolean;
  sheet: ReturnType<typeof useTicketSheet>;
  children: ReactNode;
}) {
  const { wide, visible, sheet, children } = props;
  if (wide)
    return visible ? (
      <aside className="lg:sticky lg:top-0 lg:self-start" aria-label="Ticket">
        {children}
      </aside>
    ) : null;
  return sheet.isOpen ? <DraftSheet onClose={sheet.close}>{children}</DraftSheet> : null;
}

function ChatArea({ chat, onRestarted }: { chat: Availability['chat']; onRestarted: () => void }) {
  if (chat.state === 'AVAILABLE')
    return <ChatPanel maxChars={chat.maxMessageChars} onRestarted={onRestarted} />;
  if (chat.state === 'DISABLED')
    return (
      <EmptyState
        title="Chat is switched off"
        body="The BookLeaf team has turned off chat for now. You can raise a ticket instead."
      />
    );
  return <Unavailable channel="Chat" />;
}

function Assistant({
  availability,
  call,
}: {
  availability: Availability;
  call: VoiceCallControls;
}) {
  const { chat, voice } = availability;
  const wide = useMediaQuery(WIDE);
  const [callOpen, setCallOpen] = useState(false);
  const ticket = useTicket(chat.state === 'AVAILABLE', call);
  const sheet = useTicketSheet(ticket.draft);
  const callShown = callOpen || call.view.phase !== 'idle';
  const closeTicket = ticket.close;
  const reset = useCallback(() => {
    call.reset();
    setCallOpen(false);
    closeTicket();
  }, [call, closeTicket]);
  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-w-0 flex-col gap-4" aria-label="Ask BookLeaf">
        <AskHeader
          voice={voice.state}
          callShown={callShown}
          onCall={() => setCallOpen(true)}
          onTicket={wide ? ticket.open : sheet.show}
          ticketHasContent={draftHasContent(ticket.draft) && ticket.draft?.status !== 'SUBMITTED'}
        />
        {callShown && voice.state === 'AVAILABLE' ? (
          <VoiceCallPanel
            call={call}
            maxSeconds={voice.maxCallSeconds}
            callsPerHour={voice.callsPerHour}
          />
        ) : null}
        <ChatArea chat={chat} onRestarted={reset} />
      </section>
      <TicketSlot wide={wide} visible={ticket.visible} sheet={sheet}>
        {ticket.panel}
      </TicketSlot>
    </div>
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
  return <Assistant availability={availability.data} call={call} />;
}
