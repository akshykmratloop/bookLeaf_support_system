import type { CheckResult, Draft } from '@bookleaf/shared';
import { useState } from 'react';
import { errorMessage, isApiError } from '../../lib/api';
import { checkReply } from '../../lib/queries';
import { useToast } from '../molecules/Toast';
import { useReplySend, type Mode, type ReplyPayload } from './useReplySend';
import { useReplyText } from './useReplyText';

export type { Mode } from './useReplySend';

const blocking = (r: CheckResult | null) => r?.issues.filter((i) => i.severity === 'BLOCK') ?? [];

/** The check result the server sent back when it refused a reply, if any. */
const rejectedCheck = (err: unknown) =>
  isApiError(err) ? (err.problem.details as CheckResult | undefined) : undefined;

function payloadOf(body: string, kind: Mode, overrideReason: string): ReplyPayload {
  const reason = overrideReason.trim();
  return { body, kind, ...(reason ? { overrideReason: reason } : {}) };
}

function useFactCheck(ticketId: string, text: string, onResult: (r: CheckResult) => void) {
  const toast = useToast();
  const [isChecking, setChecking] = useState(false);
  const runCheck = async () => {
    setChecking(true);
    try {
      onResult(await checkReply(ticketId, text));
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setChecking(false);
    }
  };
  return { runCheck, isChecking };
}

/** State and actions for writing a reply: load the draft, edit, check, send (with audited override). */
export function useReplyComposer(ticketId: string, draft: Draft | null) {
  const toast = useToast();
  const reply = useReplyText(draft);
  const [mode, setMode] = useState<Mode>('REPLY');
  const [overrideReason, setOverrideReason] = useState('');
  const factCheck = useFactCheck(ticketId, reply.text, reply.setCheck);
  const sender = useReplySend(ticketId);

  const submit = () => {
    sender.send(payloadOf(reply.text, mode, overrideReason), {
      onSuccess: () => {
        toast('success', mode === 'REPLY' ? 'Reply sent to the author' : 'Internal note added');
        reply.clear();
        setOverrideReason('');
      },
      onError: (err) => {
        const details = rejectedCheck(err);
        if (details?.issues) reply.setCheck(details);
        toast('error', errorMessage(err));
      },
    });
  };

  const isReply = mode === 'REPLY';
  const blocks = blocking(reply.check);
  return {
    ...reply,
    ...factCheck,
    mode,
    setMode,
    check: isReply ? reply.check : null,
    overrideReason,
    setOverrideReason,
    isSending: sender.isSending,
    submit,
    needsOverride: isReply && blocks.length > 0 && blocks.every((i) => i.overridable),
    hardBlocked: isReply && blocks.some((i) => !i.overridable),
  };
}
