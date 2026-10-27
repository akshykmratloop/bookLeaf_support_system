import type { ChannelState } from '@bookleaf/shared';
import { Phone, TicketPlus } from 'lucide-react';
import { Button } from '../atoms/Button';

interface Props {
  voice: ChannelState;
  /** A call is starting, live or just ended: its panel is already showing. */
  callShown: boolean;
  onCall: () => void;
  /** Narrow layout only: opens the ticket sheet. Absent when the ticket is in a side column. */
  onTicket?: () => void;
  ticketHasContent: boolean;
}

export function AskHeader({ voice, callShown, onCall, onTicket, ticketHasContent }: Props) {
  const callable = voice === 'AVAILABLE';
  return (
    <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 bg-app/90 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <div className="min-w-0">
        <h1 className="text-[20px] font-bold lg:text-[24px]">Ask BookLeaf</h1>
        <p className="text-[12.5px] text-ink-2">Answers from your records, by chat or call.</p>
      </div>
      <div className="flex items-center gap-2">
        {onTicket ? (
          <Button
            variant="secondary"
            size="sm"
            pill
            onClick={onTicket}
            icon={<TicketPlus size={14} aria-hidden />}
          >
            Ticket
            {ticketHasContent ? (
              <span aria-label="has a draft" className="h-2 w-2 rounded-full bg-coral" />
            ) : null}
          </Button>
        ) : null}
        {voice === 'DISABLED' || callShown ? null : (
          <Button
            variant="soft"
            size="sm"
            pill
            onClick={onCall}
            disabled={!callable}
            title={callable ? 'Talk to the assistant' : 'Calls are unavailable right now'}
            icon={<Phone size={14} aria-hidden />}
          >
            Call
          </Button>
        )}
      </div>
    </div>
  );
}
