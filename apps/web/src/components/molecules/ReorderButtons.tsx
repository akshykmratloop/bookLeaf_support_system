import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '../atoms/Button';

interface Props {
  /** What is being moved, for screen readers ("Billing"). */
  name: string;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onMove: (by: -1 | 1) => void;
}

/** Move one row of an ordered list up or down. */
export function ReorderButtons({ name, isFirst, isLast, disabled, onMove }: Props) {
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Move ${name} up`}
        icon={<ArrowUp size={14} aria-hidden />}
        disabled={disabled || isFirst}
        onClick={() => onMove(-1)}
      />
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Move ${name} down`}
        icon={<ArrowDown size={14} aria-hidden />}
        disabled={disabled || isLast}
        onClick={() => onMove(1)}
      />
    </div>
  );
}
