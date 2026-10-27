import type { AdminTicket, CheckResult, Draft } from '@bookleaf/shared';
import { useEffect, useState } from 'react';
import { api, errorMessage, isApiError } from '../../lib/api';
import { newRequestKey } from '../../lib/ids';
import { checkReply, keys, useApiMutation } from '../../lib/queries';
import { useToast } from '../molecules/Toast';

export type Mode = 'REPLY' | 'INTERNAL_NOTE';

const blocking = (r: CheckResult | null) => r?.issues.filter((i) => i.severity === 'BLOCK') ?? [];

/** State and actions for writing a reply: load the draft, edit, check, send (with audited override). */
export function useReplyComposer(ticketId: string, draft: Draft | null) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('REPLY');
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [isChecking, setChecking] = useState(false);
  const [requestKey, setRequestKey] = useState(newRequestKey);

  // Load a new draft into the editor only when the editor is untouched or still holds the old draft.
  useEffect(() => {
    if (!draft || draft.id === loadedDraftId) return;
    setText((current) => (current.trim() === '' || loadedDraftId !== null ? draft.body : current));
    setCheck(draft.check);
    setLoadedDraftId(draft.id);
  }, [draft, loadedDraftId]);

  const send = useApiMutation(
    (body: { body: string; kind: Mode; overrideReason?: string }) =>
      api<AdminTicket>(`/tickets/${ticketId}/messages`, { method: 'POST', body, idempotencyKey: requestKey }),
    [keys.ticket(ticketId), keys.tickets()],
  );

  const runCheck = async () => {
    setChecking(true);
    try {
      setCheck(await checkReply(ticketId, text));
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  const submit = () => {
    const payload = { body: text, kind: mode, ...(overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}) };
    send.mutate(payload, {
      onSuccess: () => {
        toast('success', mode === 'REPLY' ? 'Reply sent to the author' : 'Internal note added');
        setText('');
        setOverrideReason('');
        setCheck(null);
        setRequestKey(newRequestKey());
      },
      onError: (err) => {
        const details = isApiError(err) ? (err.problem.details as CheckResult | undefined) : undefined;
        if (details?.issues) setCheck(details);
        toast('error', errorMessage(err));
      },
    });
  };

  const blocks = blocking(check);
  const canOverride = blocks.length > 0 && blocks.every((i) => i.overridable);
  return {
    text,
    // Any edit makes the previous check result stale; the server re-checks on send anyway.
    setText: (value: string) => {
      setText(value);
      setCheck(null);
    },
    mode,
    setMode,
    check: mode === 'REPLY' ? check : null,
    overrideReason,
    setOverrideReason,
    isChecking,
    isSending: send.isPending,
    runCheck,
    submit,
    useDraft: () => draft && setText(draft.body),
    needsOverride: mode === 'REPLY' && canOverride,
    hardBlocked: mode === 'REPLY' && blocks.some((i) => !i.overridable),
  };
}
