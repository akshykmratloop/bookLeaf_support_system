import type { Dashboard } from '@bookleaf/host-demo/dashboard';
import { CalendarClock, CheckCircle2, Hourglass } from 'lucide-react';
import { ringDash } from '../lib/chart';
import { day, plural, rupees } from '../lib/format';
import { Card } from './Card';

const R = 52;

function Ring({ percent }: { percent: number }) {
  const { dasharray } = ringDash(R, percent);
  return (
    <svg
      viewBox="0 0 128 128"
      className="h-32 w-32 shrink-0"
      role="img"
      aria-label={`${percent}% of the payout threshold`}
    >
      <circle cx="64" cy="64" r={R} fill="none" stroke="var(--grid)" strokeWidth="12" />
      <circle
        cx="64"
        cy="64"
        r={R}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={dasharray}
        transform="rotate(-90 64 64)"
        style={{ transition: 'stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)' }}
      />
      <text
        x="64"
        y="62"
        textAnchor="middle"
        className="fill-[var(--ink)] text-[24px] font-extrabold"
      >
        {percent}%
      </text>
      <text x="64" y="82" textAnchor="middle" className="fill-[var(--ink-3)] text-[11px]">
        of threshold
      </text>
    </svg>
  );
}

/** Where the next payout stands: progress to ₹1,000 and days to the next deadline. */
export function PayoutCard({
  payout,
  pendingPaise,
}: {
  payout: Dashboard['payout'];
  pendingPaise: number;
}) {
  return (
    <Card title="Next payout" subtitle="Royalties are paid within 45 days of each quarter's end.">
      <div className="flex flex-wrap items-center gap-5">
        <Ring percent={payout.progressPercent} />
        <div className="flex min-w-[180px] flex-1 flex-col gap-3">
          <p className="text-[24px] font-extrabold">{rupees(pendingPaise)}</p>
          {payout.eligible ? (
            <p className="flex items-start gap-2 text-[13px] text-brand">
              <CheckCircle2 size={16} aria-hidden className="mt-0.5 shrink-0" />
              Above the {rupees(payout.thresholdPaise)} minimum: due in the next payout.
            </p>
          ) : (
            <p className="flex items-start gap-2 text-[13px] text-warn">
              <Hourglass size={16} aria-hidden className="mt-0.5 shrink-0" />
              {rupees(payout.thresholdPaise - pendingPaise)} more to reach the{' '}
              {rupees(payout.thresholdPaise)} minimum. It rolls over until then.
            </p>
          )}
          <p className="flex items-center gap-2 rounded-xl bg-panel-2 px-3 py-2 text-[13px]">
            <CalendarClock size={16} aria-hidden className="text-ink-3" />
            Cycle closes {day(payout.nextCycleDeadline)} ·{' '}
            <strong>{plural(payout.daysToDeadline, 'day')}</strong> left
          </p>
        </div>
      </div>
    </Card>
  );
}
