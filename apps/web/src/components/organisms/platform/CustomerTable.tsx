import type { CustomerSummary } from '@bookleaf/shared';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { Pill } from '../../atoms/Pill';
import { formatCost } from '../../../lib/platform';

function StatusPills({ c }: { c: CustomerSummary }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {c.suspended ? (
        <Pill tone="danger" dot>
          Suspended
        </Pill>
      ) : (
        <Pill tone="success" dot>
          Active
        </Pill>
      )}
      {c.plan.aiEnabled ? null : <Pill tone="warning">AI off</Pill>}
      {c.plan.chatAllowed ? <Pill tone="neutral">Chat</Pill> : null}
      {c.plan.voiceAllowed ? <Pill tone="neutral">Voice</Pill> : null}
    </div>
  );
}

const num = (n: number) => n.toLocaleString('en-US');

/** One customer as a card (narrow screens) or a table row (wide); counts only, no content. */
function Row({ c }: { c: CustomerSummary }) {
  const u = c.usage;
  const cells = [
    { label: 'Tickets (30 d / all)', value: `${num(u.ticketsRecent)} / ${num(u.tickets)}` },
    { label: 'Chats', value: num(u.conversations) },
    { label: 'Calls', value: `${num(u.calls)} · ${num(u.callMinutes)} min` },
    { label: 'AI runs', value: num(u.aiRuns) },
    { label: 'AI cost', value: formatCost(u.aiCostMicros) },
  ];
  return (
    <li className="grid gap-3 border-b border-line p-4 last:border-b-0 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_6.5rem] xl:items-center xl:gap-4">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold">
          {c.name}{' '}
          {c.isDefault ? (
            <span className="text-[12px] font-normal text-ink-3">(default)</span>
          ) : null}
        </p>
        <p className="truncate font-mono text-[11.5px] text-ink-3">
          {c.slug} · {c.ticketPrefix} · {c.staff} staff
        </p>
        <div className="mt-2">
          <StatusPills c={c} />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5 xl:contents">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0">
            <dt className="text-[11px] text-ink-3 xl:sr-only">{cell.label}</dt>
            <dd className="font-mono text-[13px] tabular-nums">{cell.value}</dd>
          </div>
        ))}
      </dl>
      <Link
        to={`/platform/customers/${c.id}`}
        className="inline-flex h-9 items-center justify-center gap-1 justify-self-start rounded-control xl:justify-self-end border border-line-strong px-3 text-[12.5px] font-semibold hover:border-brand focus-visible:ring-4 focus-visible:ring-brand/25 focus-visible:outline-none"
        aria-label={`Manage ${c.name}`}
      >
        Manage <ChevronRight size={14} aria-hidden />
      </Link>
    </li>
  );
}

const HEADINGS = ['Customer', 'Tickets 30 d / all', 'Chats', 'Calls', 'AI runs', 'AI cost', ''];

export function CustomerTable({ items }: { items: CustomerSummary[] }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-panel shadow-soft">
      <div
        aria-hidden
        className="hidden border-b border-line bg-panel-2 px-4 py-2.5 font-mono text-[10.5px] tracking-[0.08em] text-ink-3 uppercase xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_6.5rem] xl:gap-4"
      >
        {HEADINGS.map((h, i) => (
          <span key={i}>{h}</span>
        ))}
      </div>
      <ul aria-label="Customers">
        {items.map((c) => (
          <Row key={c.id} c={c} />
        ))}
      </ul>
    </div>
  );
}
