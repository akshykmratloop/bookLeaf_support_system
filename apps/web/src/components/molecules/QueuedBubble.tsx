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
    <li className="flex flex-col items-end gap-1">
      <div
        className={`max-w-[85%] rounded-[14px] border px-4 py-3 ${
          failed ? 'border-danger/40 bg-danger-bg' : 'border-brand/30 bg-brand-soft'
        } ${item.status === 'waiting' ? 'opacity-70' : ''}`}
      >
        <p className="mb-1 text-[11.5px] font-semibold text-ink-3">You</p>
        <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{item.text}</p>
      </div>
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
