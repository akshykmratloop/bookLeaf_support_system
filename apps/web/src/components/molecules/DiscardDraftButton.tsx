import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../atoms/Button';

interface Props {
  isDiscarding: boolean;
  disabled: boolean;
  onDiscard: () => void;
}

/** Discard asks once more before emptying the ticket, so a stray click never loses typing. */
export function DiscardDraftButton({ isDiscarding, disabled, onDiscard }: Props) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setAsking(true)}
        icon={<Trash2 size={14} aria-hidden />}
      >
        Discard
      </Button>
    );
  return (
    <div role="group" aria-label="Discard this ticket?" className="flex items-center gap-2">
      <span className="text-[12px] text-ink-2">Discard this ticket?</span>
      <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
        Keep
      </Button>
      <Button
        variant="danger"
        size="sm"
        isLoading={isDiscarding}
        onClick={() => {
          onDiscard();
          setAsking(false);
        }}
      >
        Discard
      </Button>
    </div>
  );
}
