import { MessageSquarePlus, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../atoms/Button';
import { Textarea } from '../atoms/Input';

interface Props {
  maxChars: number;
  turnCount: number | null;
  maxTurns: number | null;
  isSending: boolean;
  isRestarting: boolean;
  onSend: (text: string, clear: () => void) => void;
  onRestart: () => void;
}

/** Message box pinned to the bottom of the page; Enter sends, Shift+Enter adds a line. */
export function ChatComposer({
  maxChars,
  turnCount,
  maxTurns,
  isSending,
  isRestarting,
  onSend,
  onRestart,
}: Props) {
  const [text, setText] = useState('');
  const isFull = turnCount !== null && maxTurns !== null && turnCount >= maxTurns;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isFull && !isSending) onSend(text.trim(), () => setText(''));
  };
  return (
    <form
      onSubmit={submit}
      className="sticky bottom-0 flex flex-col gap-2 rounded-[14px] border border-line bg-panel p-3"
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
          {turnCount !== null && maxTurns !== null ? ` · ${turnCount}/${maxTurns} messages` : ''}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestart}
            isLoading={isRestarting}
            icon={<MessageSquarePlus size={14} aria-hidden />}
          >
            New conversation
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={isSending}
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
