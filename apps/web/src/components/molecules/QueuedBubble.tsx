import { RotateCcw, X } from 'lucide-react';
import type { QueuedMessage } from '../../lib/chatQueue';
import { Button } from '../atoms/Button';

/** An author message that is waiting, being answered, or failed to send (with retry). */
export function QueuedBubble({
  item,
  onRetry,
  onRemove,
}: {
  item: QueuedMessage;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const failed = item.status === 'failed';
  return (
    <li className="flex animate-fade-up flex-col items-end gap-1">
      <p
        className={`max-w-[82%] rounded-[20px] rounded-br-md px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap shadow-soft ${
          failed ? 'border border-danger/40 bg-danger-bg text-ink' : 'bg-brand text-white'
        } ${item.status === 'waiting' ? 'opacity-60' : ''}`}
      >
        {item.text}
      </p>
      {item.status === 'waiting' ? (
        <span className="text-[11.5px] text-ink-3">Waiting to send…</span>
      ) : null}
      {failed ? (
        <div className="flex items-center gap-2 text-[12px] text-danger" role="alert">
          <span>Not sent: {item.error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            icon={<RotateCcw size={13} aria-hidden />}
          >
            Retry
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove} icon={<X size={13} aria-hidden />}>
            Remove
          </Button>
        </div>
      ) : null}
    </li>
  );
}
