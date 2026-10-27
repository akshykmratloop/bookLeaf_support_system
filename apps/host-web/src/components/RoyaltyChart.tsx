import type { DashboardBook } from '@bookleaf/host-demo/dashboard';
import { niceMax, pct, ticks } from '../lib/chart';
import { compact, rupees } from '../lib/format';
import { Card } from './Card';

const Swatch = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden />
    {label}
  </span>
);

function Row({ book, max }: { book: DashboardBook; max: number }) {
  const paid = pct(book.royaltyPaidPaise, max);
  const pending = pct(book.royaltyPendingPaise, max);
  return (
    <li
      className="group relative grid grid-cols-[minmax(0,140px)_1fr] items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand"
      tabIndex={0}
    >
      <span className="truncate text-[12.5px] text-ink-2">{book.title}</span>
      {book.royaltyEarnedPaise === 0 ? (
        <span className="text-[12px] text-ink-3">Not on sale yet</span>
      ) : null}
      <span
        className={`h-5 items-center gap-[2px] ${book.royaltyEarnedPaise === 0 ? 'hidden' : 'flex'}`}
      >
        {paid > 0 ? (
          <span
            className="h-full rounded-l-[2px]"
            style={{ width: `${paid}%`, background: 'var(--series-1)' }}
          />
        ) : null}
        {pending > 0 ? (
          <span
            className="h-full rounded-r-[4px]"
            style={{ width: `${pending}%`, background: 'var(--series-2)' }}
          />
        ) : null}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-14 left-36 z-10 rounded-lg bg-ink px-3 py-2 text-[12px] whitespace-nowrap text-bg opacity-0 shadow-card transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <strong>{book.title}</strong>
        <br />
        Paid {rupees(book.royaltyPaidPaise)} · Pending {rupees(book.royaltyPendingPaise)}
      </span>
    </li>
  );
}

/** Earned royalty per book, split into paid and pending (stacked: they add up to earned). */
export function RoyaltyChart({ books }: { books: DashboardBook[] }) {
  const max = niceMax(Math.max(...books.map((b) => b.royaltyEarnedPaise), 0) / 100) * 100;
  return (
    <Card title="Royalty by book" subtitle="Earned so far, split into paid and pending.">
      <div className="mb-3 flex gap-4">
        <Swatch color="var(--series-1)" label="Paid" />
        <Swatch color="var(--series-2)" label="Pending" />
      </div>
      <ul className="flex flex-col gap-3">
        {books.map((b) => (
          <Row key={b.id} book={b} max={max} />
        ))}
      </ul>
      <div className="mt-2 grid grid-cols-[minmax(0,140px)_1fr] gap-3" aria-hidden>
        <span />
        <span className="flex justify-between border-t border-grid pt-1 text-[11px] text-ink-3">
          {ticks(max / 100).map((t) => (
            <span key={t}>₹{compact(t)}</span>
          ))}
        </span>
      </div>
    </Card>
  );
}
