import type { DashboardBook } from '@bookleaf/host-demo/dashboard';
import { BookOpen, Store } from 'lucide-react';
import { day, rupees } from '../lib/format';
import { ROYALTY_STATUS } from '../lib/royaltyStatus';
import { StageTrack } from './StageTrack';

function Fact({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11.5px] text-ink-3">{label}</dt>
      <dd className={`text-[13.5px] ${strong ? 'font-extrabold' : 'font-semibold'}`}>{value}</dd>
    </div>
  );
}

/** One book with every field BookLeaf keeps for it. */
export function BookCard({ book: b }: { book: DashboardBook }) {
  const status = ROYALTY_STATUS[b.royaltyStatus];
  return (
    <article className="flex animate-rise flex-col gap-4 rounded-card border border-line bg-panel p-5 shadow-card">
      <header className="flex items-start gap-3">
        <span className="grid h-14 w-11 shrink-0 place-items-center rounded-md bg-gradient-to-br from-brand to-[#0b5e3b] text-white shadow-card">
          <BookOpen size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[18px] leading-snug font-semibold">{b.title}</h3>
          <p className="text-[12.5px] text-ink-3">
            {b.genre} · ISBN {b.isbn}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${b.live ? 'bg-brand-soft text-brand' : 'bg-warn-soft text-warn'}`}
        >
          {b.live ? 'Live' : 'In production'}
        </span>
      </header>
      {b.live ? null : <StageTrack stageIndex={b.stageIndex} />}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Fact label="Published" value={day(b.publicationDate)} />
        <Fact label="MRP" value={rupees(b.mrpPaise)} />
        <Fact label="Royalty per copy" value={rupees(b.royaltyPerCopyPaise)} />
        <Fact label="Copies sold" value={String(b.copiesSold)} strong />
        <Fact label="Royalty earned" value={rupees(b.royaltyEarnedPaise)} strong />
        <Fact label="Paid out" value={rupees(b.royaltyPaidPaise)} />
        <Fact label="Pending" value={rupees(b.royaltyPendingPaise)} strong />
        <Fact label="Last payout" value={day(b.lastPayoutDate, 'None yet')} />
        <Fact label="Print partner" value={b.printPartner ?? 'Not set yet'} />
      </dl>
      <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${status.tone}`}>
          {status.label}
        </span>
        <span className="flex-1" />
        {b.availableOn.length ? (
          b.availableOn.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full bg-panel-2 px-2.5 py-1 text-[11.5px] font-semibold text-ink-2"
            >
              <Store size={11} aria-hidden /> {p}
            </span>
          ))
        ) : (
          <span className="text-[12px] text-ink-3">Not on sale yet</span>
        )}
      </footer>
    </article>
  );
}
