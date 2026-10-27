import { DESCRIPTION_LIMITS, SUBJECT_LIMITS, type TicketDraft } from '@bookleaf/shared';
import { CheckCircle2, Send, TicketPlus } from 'lucide-react';
import { Link } from 'react-router';
import { useBooks } from '../../lib/queries';
import type { DraftEditor, EditorView } from '../../lib/draftEditor';
import { useDraftEditor } from '../../lib/useDraftEditor';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Pill } from '../atoms/Pill';
import { DiscardDraftButton } from '../molecules/DiscardDraftButton';
import { DraftFields } from '../molecules/DraftFields';

interface Props {
  draft: TicketDraft | null;
  origin: 'chat' | 'call';
  onSaved: (draft: TicketDraft) => void;
  /** Starts an empty draft for the current chat; absent when that is not possible. */
  onStart?: () => void;
  isStarting?: boolean;
}

function Empty({ onStart, isStarting }: Pick<Props, 'onStart' | 'isStarting'>) {
  return (
    <div className="flex flex-col items-start gap-3 text-[13px] text-ink-2">
      <p>
        No ticket yet. Ask the assistant to raise one, by chat or on a call, and it will fill it in
        here as you talk.
      </p>
      {onStart ? (
        <Button
          variant="secondary"
          size="sm"
          isLoading={isStarting}
          onClick={onStart}
          icon={<TicketPlus size={14} aria-hidden />}
        >
          Start a ticket
        </Button>
      ) : null}
    </div>
  );
}

function SentNote({ ticket }: { ticket: NonNullable<TicketDraft['ticket']> }) {
  return (
    <p className="flex items-start gap-2 rounded-[10px] bg-success-bg p-3 text-[13px] text-success">
      <CheckCircle2 size={16} aria-hidden className="mt-0.5 shrink-0" />
      <span>
        Ticket{' '}
        <Link className="font-semibold underline" to={`/tickets/${ticket.id}`}>
          {ticket.number}
        </Link>{' '}
        sent. The support team will reply there.
      </span>
    </p>
  );
}

const isReady = (v: EditorView['values']) =>
  v.subject.trim().length >= SUBJECT_LIMITS.min &&
  v.description.trim().length >= DESCRIPTION_LIMITS.min;

const isBlank = (v: EditorView['values']) =>
  !v.category && !v.bookId && !v.subject.trim() && !v.description.trim();

function statusOf(view: EditorView, ready: boolean): string {
  if (view.sending) return 'Sending…';
  if (view.discarding) return 'Discarding…';
  if (view.saving) return 'Saving…';
  return ready ? 'Ready to send' : 'Needs a subject and a short description';
}

function SendRow({ view, editor }: { view: EditorView; editor: DraftEditor }) {
  const ready = isReady(view.values);
  const busy = view.sending || view.discarding;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-[12px] text-ink-3" aria-live="polite">
        {statusOf(view, ready)}
      </span>
      <div className="flex items-center gap-2">
        <DiscardDraftButton
          isDiscarding={view.discarding}
          disabled={busy || isBlank(view.values)}
          onDiscard={() => void editor.discard()}
        />
        <Button
          onClick={() => void editor.send()}
          isLoading={view.sending}
          disabled={!ready || view.saving || busy}
          icon={<Send size={14} aria-hidden />}
        >
          Send
        </Button>
      </div>
    </div>
  );
}

function DraftBody({
  view,
  editor,
  current,
}: {
  view: EditorView;
  editor: DraftEditor;
  current: TicketDraft;
}) {
  const books = useBooks();
  const sent = current.status === 'SUBMITTED';
  return (
    <>
      {current.status === 'AWAITING_CONFIRMATION' ? (
        <p role="status" className="rounded-[10px] bg-brand-soft p-3 text-[13px] text-brand">
          Ask BookLeaf asked you to confirm. Check the ticket, then press Send or say yes.
        </p>
      ) : null}
      {sent && current.ticket ? <SentNote ticket={current.ticket} /> : null}
      <DraftFields
        values={view.values}
        books={books.data ?? []}
        disabled={sent || view.sending || view.discarding}
        highlighted={view.highlighted}
        onChange={(field, value) => editor.change(field, value)}
      />
      {view.error ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {view.error}
        </p>
      ) : null}
      {sent ? null : <SendRow view={view} editor={editor} />}
    </>
  );
}

/** The ticket the author and the assistant prepare together; the author can edit any field. */
export function TicketDraftPanel({ draft, origin, onSaved, onStart, isStarting }: Props) {
  const { view, editor } = useDraftEditor(draft, onSaved);
  return (
    <Card className="flex flex-col gap-4 p-4" role="region" aria-label="Your ticket">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[14px] font-semibold">
          <TicketPlus size={15} aria-hidden /> Your ticket
        </p>
        <Pill tone={origin === 'call' ? 'brand' : 'neutral'}>
          {origin === 'call' ? 'From your call' : 'From this chat'}
        </Pill>
      </div>
      {view.draft ? (
        <DraftBody view={view} editor={editor} current={view.draft} />
      ) : (
        <Empty onStart={onStart} isStarting={isStarting} />
      )}
    </Card>
  );
}
