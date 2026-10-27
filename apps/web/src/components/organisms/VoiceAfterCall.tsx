import type { VoiceEndReason } from '@bookleaf/shared';
import { useVoiceCallRecord } from '../../lib/assistant';
import { LoadingState } from '../molecules/States';
import { TicketSentNote } from '../molecules/TicketSentNote';
import { TranscriptList } from '../molecules/TranscriptList';

const ENDED_TEXT: Record<VoiceEndReason, string> = {
  USER_HANGUP: 'You ended the call.',
  TIME_LIMIT: 'The call reached its time limit.',
  ASSISTANT_ENDED: 'The call has ended.',
  IDLE: 'The call ended because no audio was heard for a while.',
  DISCONNECTED: 'The connection was lost.',
  DISABLED_BY_ADMIN: 'Voice calls were switched off by the BookLeaf team.',
  PROVIDER_ERROR: 'The voice service had a problem, so the call ended.',
  SERVER_RESTART: 'The call was interrupted.',
};

type CallRecord = NonNullable<ReturnType<typeof useVoiceCallRecord>['data']>;

/** The call's ticket if it was sent, otherwise a pointer to the unsent draft. */
function CallTicket({ call }: { call: CallRecord }) {
  const ticket = call.ticket ?? call.draft?.ticket ?? null;
  if (ticket)
    return (
      <TicketSentNote ticket={ticket}>
        was sent from this call. The team will reply there.
      </TicketSentNote>
    );
  if (!call.draft?.subject) return null;
  return (
    <p className="text-[12.5px] text-ink-2">
      Your ticket from this call is on the right. You can still edit it and press Send.
    </p>
  );
}

/** After a call: what was said. The call's ticket stays in the panel beside it. */
export function VoiceAfterCall({
  callId,
  reason,
}: {
  callId: string;
  reason: VoiceEndReason | null;
}) {
  const record = useVoiceCallRecord(callId);
  if (record.isPending) return <LoadingState label="Saving the call…" />;
  const call = record.data;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-2">
        {reason ? ENDED_TEXT[reason] : 'The call has ended.'}
      </p>
      {call?.transcript.length ? (
        <TranscriptList
          lines={call.transcript}
          className="flex flex-col gap-2"
          label="Call transcript"
        />
      ) : null}
      {call ? <CallTicket call={call} /> : null}
    </div>
  );
}
