import type { AdminTicketListItem } from '@bookleaf/shared';
import { useNavigate } from 'react-router';
import { relative, sla } from '../../lib/format';
import { AiBadge, CategoryLabel, PriorityPill, StatusPill } from '../molecules/DomainPills';

const th = 'px-4 py-3 text-left text-[11px] font-semibold tracking-wide text-ink-3 uppercase whitespace-nowrap';
const td = 'px-4 py-3 align-middle';

/** Rows arrive most-urgent-first from the API. Overdue first responses are highlighted. */
export function QueueTable({ items }: { items: AdminTicketListItem[] }) {
  const navigate = useNavigate();
  const open = (id: string) => navigate(`/admin/tickets/${id}`);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead className="border-b border-line">
          <tr>
            <th className={th}>Ticket</th>
            <th className={th}>Category</th>
            <th className={th}>Priority</th>
            <th className={th}>Status</th>
            <th className={th}>First response</th>
            <th className={th}>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const s = sla(t.slaDueAt, t.firstResponseAt);
            const unresolved = t.status === 'OPEN' || t.status === 'IN_PROGRESS';
            const late = s.overdue && unresolved;
            return (
              <tr
                key={t.id}
                tabIndex={0}
                onClick={() => open(t.id)}
                onKeyDown={(e) => e.key === 'Enter' && open(t.id)}
                className={`cursor-pointer border-b border-line last:border-0 hover:bg-panel-2 ${late ? 'bg-danger-bg/40' : ''}`}
              >
                <td className={`${td} min-w-[280px]`}>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11.5px] text-ink-3">{t.number}</span>
                    <AiBadge state={t.aiState} needsReview={t.needsReview} />
                  </span>
                  <span className="block font-semibold">{t.subject}</span>
                  <span className="block text-[12px] text-ink-3">
                    {t.author.name} · {t.book?.title ?? 'General'} · {relative(t.createdAt)}
                  </span>
                </td>
                <td className={td}>
                  <CategoryLabel category={t.category} source={t.categorySource} />
                </td>
                <td className={td}>
                  <PriorityPill priority={t.priority} />
                </td>
                <td className={td}>
                  <StatusPill status={t.status} />
                </td>
                <td className={`${td} whitespace-nowrap ${late ? 'font-semibold text-danger' : 'text-ink-2'}`}>
                  {unresolved || t.firstResponseAt ? s.text : '—'}
                </td>
                <td className={`${td} whitespace-nowrap text-ink-2`}>{t.assignee?.name ?? 'Unassigned'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
