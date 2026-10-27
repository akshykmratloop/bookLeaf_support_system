import type { DashboardBook } from '@bookleaf/host-demo/dashboard';
import { AlertTriangle } from 'lucide-react';
import { openHelp } from '../lib/useSupportWidget';

/** Pending royalty with no payout although a deadline passed: say so, and offer help. */
export function OverdueAlert({ books }: { books: DashboardBook[] }) {
  if (books.length === 0) return null;
  return (
    <div
      role="status"
      className="flex animate-rise flex-wrap items-center gap-3 rounded-card border border-warn/30 bg-warn-soft p-4"
    >
      <AlertTriangle size={20} aria-hidden className="shrink-0 text-warn" />
      <p className="min-w-0 flex-1 text-[13.5px]">
        <strong>Our records show no payout yet</strong> for {books.map((b) => b.title).join(', ')},
        although a payout deadline has passed. We can check it for you.
      </p>
      <button
        type="button"
        onClick={() => openHelp()}
        className="h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-bg hover:opacity-90"
      >
        Ask support
      </button>
    </div>
  );
}
