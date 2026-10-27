import { MessageSquarePlus, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../atoms/Button';
import { Textarea } from '../atoms/Input';

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
 * Message box pinned to the bottom of the page; Enter sends, Shift+Enter adds a line. The box
 * clears at once and stays usable, so the author can send the next message while waiting.
 */
export function ChatComposer({
  maxChars,
  usedTurns,
  maxTurns,
  isRestarting,
  canRestart,
  onSend,
  onRestart,
}: Props) {
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
      className="sticky bottom-0 flex flex-col gap-2 rounded-card border border-line bg-panel p-3"
    >
      <label htmlFor="chat-input" className="sr-only">
        Your question
      </label>
      <Textarea
        id="chat-input"
        rows={2}
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
      />
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-ink-3">
          {text.length}/{maxChars}
          {usedTurns !== null && maxTurns !== null ? ` · ${usedTurns}/${maxTurns} messages` : ''}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestart}
            isLoading={isRestarting}
            disabled={!canRestart}
            title={canRestart ? 'Start a new conversation' : 'This conversation is already new'}
            icon={<MessageSquarePlus size={14} aria-hidden />}
          >
            New conversation
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!text.trim() || isFull}
            icon={<Send size={14} aria-hidden />}
          >
            Send
          </Button>
        </div>
      </div>
    </form>
  );
}
