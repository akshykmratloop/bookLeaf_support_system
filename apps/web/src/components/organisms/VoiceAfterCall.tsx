import type { VoiceEndReason } from '@bookleaf/shared';
import { Link } from 'react-router';
import { useVoiceCallRecord } from '../../lib/assistant';
import { Card } from '../atoms/Card';
import { ChatBubble } from '../molecules/ChatBubble';
import { LoadingState } from '../molecules/States';

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
  const ticket = call?.ticket ?? call?.draft?.ticket ?? null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-2">
        {reason ? ENDED_TEXT[reason] : 'The call has ended.'}
      </p>
      {call?.transcript.length ? (
        <ol className="flex flex-col gap-2" aria-label="Call transcript">
          {call.transcript.map((l, i) => (
            <ChatBubble
              key={`${l.at}-${i}`}
              message={{ role: l.role, body: l.text, source: null, factsUsed: [] }}
            />
          ))}
        </ol>
      ) : null}
      {ticket ? (
        <Card className="p-3 text-[13px]">
          Ticket{' '}
          <Link className="font-semibold text-brand underline" to={`/tickets/${ticket.id}`}>
            {ticket.number}
          </Link>{' '}
          was sent from this call. The team will reply there.
        </Card>
      ) : call?.draft?.subject ? (
        <p className="text-[12.5px] text-ink-2">
          Your ticket from this call is on the right. You can still edit it and press Send.
        </p>
      ) : null}
    </div>
  );
}
