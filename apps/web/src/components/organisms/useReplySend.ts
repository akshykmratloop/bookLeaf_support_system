import type { AdminTicket } from '@bookleaf/shared';
import { useState } from 'react';
import { api } from '../../lib/api';
import { newRequestKey } from '../../lib/ids';
import { keys, useApiMutation } from '../../lib/queries';

export type Mode = 'REPLY' | 'INTERNAL_NOTE';

export interface ReplyPayload {
  body: string;
  kind: Mode;
  overrideReason?: string;
}

/** Posts a reply or note. One request key per message, so a retried send never doubles it. */
export function useReplySend(ticketId: string) {
  const [requestKey, setRequestKey] = useState(newRequestKey);
  const send = useApiMutation(
    (body: ReplyPayload) =>
      api<AdminTicket>(`/tickets/${ticketId}/messages`, {
        method: 'POST',
        body,
        idempotencyKey: requestKey,
      }),
    [keys.ticket(ticketId), keys.tickets()],
  );
  return {
    send: (payload: ReplyPayload, on: { onSuccess: () => void; onError: (e: unknown) => void }) =>
      send.mutate(payload, {
        onSuccess: () => {
          setRequestKey(newRequestKey());
          on.onSuccess();
        },
        onError: on.onError,
      }),
    isSending: send.isPending,
  };
}
