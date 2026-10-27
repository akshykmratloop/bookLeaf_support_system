import type { Dashboard } from '@bookleaf/host-demo/dashboard';
import { useQueryClient } from '@tanstack/react-query';
import { BookCopy, IndianRupee, Library, Wallet } from 'lucide-react';
import { AccountCard } from '../components/AccountCard';
import { BookCard } from '../components/BookCard';
import { CopiesChart } from '../components/CopiesChart';
import { KpiTile } from '../components/KpiTile';
import { OverdueAlert } from '../components/OverdueAlert';
import { PayoutCard } from '../components/PayoutCard';
import { RoyaltyChart } from '../components/RoyaltyChart';
import { TopBar } from '../components/TopBar';
import { Waves } from '../components/Waves';
import { signOut } from '../lib/api';
import { day, firstName, plural, rupees } from '../lib/format';
import { DASHBOARD_KEY } from '../lib/keys';
import { useSupportWidget } from '../lib/useSupportWidget';

function Kpis({ totals }: { totals: Dashboard['totals'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiTile
        label="Royalty earned"
        value={rupees(totals.earnedPaise)}
        hint="All time, all books"
        Icon={IndianRupee}
        tone="bg-brand-soft text-brand-ink"
      />
      <KpiTile
        label="Paid out"
        value={rupees(totals.paidPaise)}
        hint="Sent to your bank"
        Icon={Wallet}
        tone="bg-panel-2 text-ink-2"
      />
      <KpiTile
        label="Copies sold"
        value={totals.copiesSold.toLocaleString('en-IN')}
        hint="Across every platform"
        Icon={BookCopy}
        tone="bg-warn-soft text-warn"
      />
      <KpiTile
        label="Books"
        value={String(totals.books)}
        hint={`${totals.liveBooks} live · ${totals.inProduction} in production`}
        Icon={Library}
        tone="bg-panel-2 text-ink-2"
      />
    </div>
  );
}

/** BookLeaf's author dashboard, with the support widget for help. */
export function DashboardPage({ data }: { data: Dashboard }) {
  const qc = useQueryClient();
  useSupportWidget();
  const leave = async () => {
    await signOut().catch(() => undefined);
    qc.removeQueries({ queryKey: DASHBOARD_KEY });
    window.location.reload(); // also removes the support widget
  };
  const overdue = data.books.filter((b) => data.payout.overdueBookIds.includes(b.id));
  return (
    <div className="flex h-full flex-col">
      <TopBar name={data.profile.name} onSignOut={() => void leave()} />
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-none">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-6 pb-28 lg:px-8">
          <div className="relative animate-rise overflow-hidden rounded-card border border-line bg-[linear-gradient(120deg,var(--brand-soft),var(--panel)_55%,var(--cream))] px-6 pt-6 pb-10 lg:px-8">
            <Waves />
            <h1 className="relative text-[30px] leading-tight font-light tracking-tight lg:text-[40px]">
              Hello, <span className="text-brand-ink">{firstName(data.profile.name)}</span>
            </h1>
            <p className="relative mt-1 text-ink-2">
              {plural(data.totals.books, 'book')} · figures as of {day(data.asOf)}
            </p>
          </div>
          <OverdueAlert books={overdue} />
          <Kpis totals={data.totals} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <PayoutCard payout={data.payout} pendingPaise={data.totals.pendingPaise} />
            <RoyaltyChart books={data.books} />
          </div>
          <section aria-label="Your books" className="flex flex-col gap-3">
            <h2 className="text-[18px] font-bold">Your books</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {data.books.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          </section>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <CopiesChart books={data.books} />
            <AccountCard profile={data.profile} />
          </div>
        </div>
      </main>
    </div>
  );
}
