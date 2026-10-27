import { AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../atoms/Button';
import { Spinner } from '../atoms/Spinner';

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-panel-2 text-ink-3">
        <Inbox size={20} aria-hidden />
      </span>
      <p className="text-[15px] font-semibold">{title}</p>
      {body ? <p className="max-w-sm text-[13px] text-ink-2">{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle size={20} aria-hidden />
      </span>
      <p className="text-[14px] text-ink">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex justify-center py-14">
      <Spinner label={label} />
    </div>
  );
}
