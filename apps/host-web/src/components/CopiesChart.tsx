import type { DashboardBook } from '@bookleaf/host-demo/dashboard';
import { niceMax, pct } from '../lib/chart';
import { Card } from './Card';

/** Copies sold per book: one series, so the title names it and there is no legend. */
export function CopiesChart({ books }: { books: DashboardBook[] }) {
  const max = niceMax(Math.max(...books.map((b) => b.copiesSold), 0));
  return (
    <Card title="Copies sold" subtitle="All time, by book.">
      <ul className="flex flex-col gap-3">
        {books.map((b) => (
          <li
            key={b.id}
            className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3"
            title={`${b.title}: ${b.copiesSold} copies`}
          >
            <span className="truncate text-[12.5px] text-ink-2">{b.title}</span>
            <span
              className="h-5 rounded-r-[4px] bg-brand"
              style={{ width: `${Math.max(pct(b.copiesSold, max), b.copiesSold ? 1 : 0)}%` }}
            />
            <span className="text-[12.5px] font-bold tabular-nums">{b.copiesSold}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
