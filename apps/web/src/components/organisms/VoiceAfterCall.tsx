import type { VoiceEndReason } from '@bookleaf/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../../lib/api';
import { assistantKeys, raiseVoiceTicket, useVoiceCallRecord } from '../../lib/assistant';
import { newRequestKey } from '../../lib/ids';
import { keys, useBooks } from '../../lib/queries';
import { Card } from '../atoms/Card';
import { ChatBubble } from '../molecules/ChatBubble';
import { LoadingState } from '../molecules/States';
import { useToast } from '../molecules/Toast';
import { ChatTicketCard } from './ChatTicketCard';

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

/** After a call: what was said, and the ticket the assistant prepared (author confirms). */
export function VoiceAfterCall({
  callId,
  reason,
}: {
  callId: string;
  reason: VoiceEndReason | null;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const books = useBooks();
  const record = useVoiceCallRecord(callId);
  const [key] = useState(newRequestKey);
  const [dismissed, setDismissed] = useState(false);
  const raise = useMutation({
    mutationFn: (v: Parameters<typeof raiseVoiceTicket>[1]) => raiseVoiceTicket(callId, v, key),
    onSuccess: async (t) => {
      toast('success', `Ticket ${t.number} raised`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: assistantKeys.voiceCall(callId) }),
        qc.invalidateQueries({ queryKey: keys.tickets() }),
      ]);
    },
    onError: (e) => toast('error', errorMessage(e)),
  });
  if (record.isPending) return <LoadingState label="Saving the call…" />;
  const call = record.data;
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
      {call?.ticket ? (
        <Card className="p-3 text-[13px]">
          Ticket{' '}
          <Link className="font-semibold text-brand underline" to={`/tickets/${call.ticket.id}`}>
            {call.ticket.number}
          </Link>{' '}
          was raised from this call. The team will reply there.
        </Card>
      ) : null}
      {call?.proposal && !call.ticket && !dismissed ? (
        <ChatTicketCard
          proposal={call.proposal}
          books={books.data ?? []}
          isSubmitting={raise.isPending}
          onDismiss={() => setDismissed(true)}
          onConfirm={(v) => raise.mutate(v)}
        />
      ) : null}
    </div>
  );
}
