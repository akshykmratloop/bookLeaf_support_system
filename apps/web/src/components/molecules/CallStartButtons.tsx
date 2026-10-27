import type { VoiceCall } from '@bookleaf/shared';
import { Phone, RotateCcw } from 'lucide-react';
import { Button } from '../atoms/Button';

interface Props {
  /** The last call, if it can be continued (ended under an hour ago, ticket not sent). */
  resumable: VoiceCall | null;
  isBusy: boolean;
  hasCalled: boolean;
  onStart: (opts: { resume: boolean }) => void;
}

const minutesAgo = (iso: string | null) =>
  iso ? Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000)) : null;

/** "Start a call", or "Continue last call" / "New call" when the last call can be picked up. */
export function CallStartButtons({ resumable, isBusy, hasCalled, onStart }: Props) {
  if (!resumable)
    return (
      <Button
        onClick={() => onStart({ resume: false })}
        isLoading={isBusy}
        icon={<Phone size={14} aria-hidden />}
      >
        {hasCalled ? 'Start a new call' : 'Start a call'}
      </Button>
    );
  const ago = minutesAgo(resumable.endedAt);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] text-ink-2">
        Your last call ended {ago ? `${ago} min ago` : 'recently'} before the ticket was sent. You
        can carry on from where you left off.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => onStart({ resume: true })}
          isLoading={isBusy}
          icon={<RotateCcw size={14} aria-hidden />}
        >
          Continue last call
        </Button>
        <Button
          variant="secondary"
          onClick={() => onStart({ resume: false })}
          disabled={isBusy}
          icon={<Phone size={14} aria-hidden />}
        >
          New call
        </Button>
      </div>
    </div>
  );
}
