import { ArrowUp, MessageSquarePlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Spinner } from '../atoms/Spinner';

interface Props {
  maxChars: number;
  /** Messages already in the conversation plus those still waiting to be answered. */
  usedTurns: number | null;
  maxTurns: number | null;
  isRestarting: boolean;
  /** False while the conversation is still empty: there is nothing to start over from. */
  canRestart: boolean;
  onSend: (text: string) => void;
  onRestart: () => void;
}

/**
 * Message box pinned to the bottom; Enter sends, Shift+Enter adds a line. The box clears at once
 * and stays usable, so the author can send the next message while waiting.
 */
export function ChatComposer(props: Props) {
  const { maxChars, usedTurns, maxTurns, isRestarting, canRestart, onSend, onRestart } = props;
  const [text, setText] = useState('');
  const isFull = usedTurns !== null && maxTurns !== null && usedTurns >= maxTurns;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || isFull) return;
    onSend(clean);
    setText('');
  };
  return (
    <form
      onSubmit={submit}
      className="sticky bottom-0 mt-auto bg-gradient-to-t from-app via-app to-transparent pt-4 pb-1"
    >
      <div className="flex items-end gap-2 rounded-[24px] border border-line bg-panel p-2 pl-4 shadow-lift focus-within:border-brand/60 focus-within:ring-4 focus-within:ring-brand/15">
        <label htmlFor="chat-input" className="sr-only">
          Your question
        </label>
        <textarea
          id="chat-input"
          rows={1}
          value={text}
          maxLength={maxChars}
          disabled={isFull}
          placeholder={
            isFull
              ? 'This conversation is full. Start a new one.'
              : 'Ask about your books, royalties or payouts…'
          }
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[14px] leading-snug text-ink [field-sizing:content] placeholder:text-ink-3 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!text.trim() || isFull}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white shadow-soft transition-all hover:bg-brand-strong disabled:opacity-35"
        >
          <ArrowUp size={18} aria-hidden />
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-2 text-[11.5px] text-ink-3">
        <button
          type="button"
          onClick={onRestart}
          disabled={!canRestart || isRestarting}
          title={canRestart ? 'Start a new conversation' : 'This conversation is already new'}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-semibold text-ink-2 hover:bg-panel-2 hover:text-ink disabled:opacity-40"
        >
          {isRestarting ? <Spinner size={12} /> : <MessageSquarePlus size={13} aria-hidden />}
          New conversation
        </button>
        <span className="font-mono">
          {text.length}/{maxChars}
          {usedTurns !== null && maxTurns !== null ? ` · ${usedTurns}/${maxTurns} messages` : ''}
        </span>
      </div>
    </form>
  );
}
