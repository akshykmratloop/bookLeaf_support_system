import { MESSAGE_LIMITS, type Draft } from '@bookleaf/shared';
import { RotateCcw, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Input, Textarea } from '../atoms/Input';
import { Pill } from '../atoms/Pill';
import { Spinner } from '../atoms/Spinner';
import { FilterChips } from '../molecules/FilterChips';
import { CheckIssues } from './EvidencePanel';
import { useReplyComposer, type Mode } from './useReplyComposer';

interface Props {
  ticketId: string;
  draft: Draft | null;
  isDraftPending: boolean;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

const MODES = [
  { value: 'REPLY', label: 'Reply to author' },
  { value: 'INTERNAL_NOTE', label: 'Internal note' },
];

function DraftHeader({ draft, pending }: { draft: Draft | null; pending: boolean }) {
  if (pending && !draft) return <Spinner size={14} label="AI is writing a draft…" />;
  if (!draft)
    return (
      <span className="text-[12.5px] text-ink-3">
        No draft yet. You can write the reply yourself.
      </span>
    );
  return (
    <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
      <Sparkles size={14} className="text-brand-ink" aria-hidden />
      {draft.source === 'AI'
        ? `AI draft (${draft.model ?? 'model'})`
        : 'Template draft (AI was unavailable)'}
      <Pill tone="neutral">Review before sending</Pill>
      {pending ? <Spinner size={12} label="Updating…" /> : null}
    </span>
  );
}

type Composer = ReturnType<typeof useReplyComposer>;

const OVERRIDE_MIN = 5;

const canSend = (c: Composer) =>
  c.text.trim().length > 0 &&
  !c.hardBlocked &&
  (!c.needsOverride || c.overrideReason.trim().length >= OVERRIDE_MIN);

/** Warnings under the text: the check result, unfilled placeholders, the override reason. */
function CheckNotes({ c }: { c: Composer }) {
  return (
    <>
      {c.check ? <CheckIssues result={c.check} /> : null}
      {c.hardBlocked ? (
        <p className="text-[12px] text-danger">
          Fill in every [CONFIRM: …] placeholder before sending.
        </p>
      ) : null}
      {c.needsOverride ? (
        <label className="flex flex-col gap-1 text-[12.5px] text-ink-2">
          Reason for sending unverified figures (saved in the audit log)
          <Input
            value={c.overrideReason}
            onChange={(e) => c.setOverrideReason(e.target.value)}
            placeholder="e.g. Finance confirmed the amount by email"
          />
        </label>
      ) : null}
    </>
  );
}

function SendButtons({ c }: { c: Composer }) {
  const isReply = c.mode === 'REPLY';
  return (
    <div className="flex gap-2">
      {isReply ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void c.runCheck()}
          isLoading={c.isChecking}
          disabled={!c.text.trim()}
          icon={<ShieldCheck size={13} aria-hidden />}
        >
          Check facts
        </Button>
      ) : null}
      <Button
        size="sm"
        onClick={c.submit}
        isLoading={c.isSending}
        disabled={!canSend(c)}
        icon={<Send size={13} aria-hidden />}
      >
        {isReply ? 'Send reply' : 'Add note'}
      </Button>
    </div>
  );
}

/** The admin always sends: AI only proposes. Replies are checked against verified facts on the server. */
export function ReplyComposer({
  ticketId,
  draft,
  isDraftPending,
  onRegenerate,
  isRegenerating,
}: Props) {
  const c = useReplyComposer(ticketId, draft);
  const isNote = c.mode === 'INTERNAL_NOTE';
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChips
          label="Message type"
          options={MODES}
          value={c.mode}
          onChange={(v) => c.setMode(v as Mode)}
        />
        <DraftHeader draft={draft} pending={isDraftPending} />
      </div>
      <Textarea
        aria-label={isNote ? 'Internal note (not visible to the author)' : 'Reply to the author'}
        rows={12}
        value={c.text}
        maxLength={MESSAGE_LIMITS.max}
        onChange={(e) => c.setText(e.target.value)}
        className={isNote ? 'border-warning/50' : ''}
      />
      <CheckNotes c={c} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            isLoading={isRegenerating}
            icon={<RotateCcw size={13} aria-hidden />}
          >
            New draft
          </Button>
          {draft ? (
            <Button variant="ghost" size="sm" onClick={c.useDraft}>
              Reset to draft
            </Button>
          ) : null}
        </div>
        <SendButtons c={c} />
      </div>
    </Card>
  );
}
