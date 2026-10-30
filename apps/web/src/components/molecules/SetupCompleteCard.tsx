import { CheckCircle2 } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';

interface Props {
  done: number;
  total: number;
  onShowSteps: () => void;
}

/** What the guide collapses to once every required step is done. */
export function SetupCompleteCard({ done, total, onShowSteps }: Props) {
  return (
    <Card role="status" className="flex flex-wrap items-center gap-3 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success-bg text-success">
        <CheckCircle2 size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">Setup complete</p>
        <p className="text-[12.5px] text-ink-2">
          {done} of {total} steps done. Support is connected to your product.
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onShowSteps}>
        Show steps
      </Button>
    </Card>
  );
}
