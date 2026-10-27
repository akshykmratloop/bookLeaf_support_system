import type { AuthorTicketListItem } from '@bookleaf/shared';
import { BookOpen } from 'lucide-react';
import { Link } from 'react-router';
import { categoryStyle, channelStyle } from '../../lib/categoryStyle';
import { relative } from '../../lib/format';
import { authorPaths } from '../../lib/paths';
import { requesterStatus } from '../../lib/ticketStatus';
import { Chip } from '../atoms/Chip';
import { Pill } from '../atoms/Pill';

/** One ticket in a list: what it is about, where it stands and who spoke last. */
export function TicketCard({ ticket }: { ticket: AuthorTicketListItem }) {
  const status = requesterStatus(ticket);
  const cat = categoryStyle(ticket.category);
  const channel = channelStyle(ticket.channel);
  const last = ticket.lastActivity;
  return (
    <Link
      to={authorPaths.ticket(ticket.id)}
      className="group flex animate-fade-up flex-col gap-3 rounded-card border border-line bg-panel p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11.5px] text-ink-3">{ticket.number}</p>
          <p className="mt-0.5 truncate text-[14.5px] font-semibold text-ink group-hover:text-brand">
            {ticket.subject}
          </p>
        </div>
        <Pill tone={status.tone} dot>
          {status.label}
        </Pill>
      </div>
      <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">
          {last.from === 'TEAM' ? 'Support: ' : 'You: '}
        </span>
        {last.preview}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Chip colors={cat.colors} icon={<cat.Icon size={12} aria-hidden />}>
          {cat.label}
        </Chip>
        {ticket.book ? (
          <Chip icon={<BookOpen size={12} aria-hidden />}>{ticket.book.title}</Chip>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-ink-3">
          <channel.Icon size={13} aria-label={channel.label} />
          {relative(last.at)}
        </span>
      </div>
    </Link>
  );
}
