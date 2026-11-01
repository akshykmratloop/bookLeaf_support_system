import { Play, Square } from 'lucide-react';
import type { MouseEvent } from 'react';

interface Props {
  voice: string;
  isPlaying: boolean;
  onToggle: () => void;
  /** Small icon inside a list row, or a full button beside the field. */
  size?: 'row' | 'field';
  disabled?: boolean;
}

const SIZE_CLASS = {
  row: 'h-6 w-6 rounded-full',
  field: 'h-[38px] w-[38px] rounded-control border border-line-strong bg-panel',
} as const;

/** Plays or stops a voice's pre-recorded sample. Never picks or opens anything around it. */
export function SamplePlayButton({ voice, isPlaying, onToggle, size = 'field', disabled }: Props) {
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onToggle();
  };
  const Icon = isPlaying ? Square : Play;
  return (
    <button
      type="button"
      // In a list row, focus stays on the dropdown; the button beside the field is the keyboard way.
      tabIndex={size === 'row' ? -1 : undefined}
      aria-label={`${isPlaying ? 'Stop' : 'Play'} sample of ${voice}`}
      aria-pressed={isPlaying}
      title={isPlaying ? 'Stop sample' : 'Play sample'}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center text-brand-ink transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASS[size]}`}
    >
      <Icon size={size === 'row' ? 12 : 14} aria-hidden fill="currentColor" />
    </button>
  );
}
