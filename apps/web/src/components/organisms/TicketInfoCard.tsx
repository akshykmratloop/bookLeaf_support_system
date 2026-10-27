import type { AuthorTicket } from '@bookleaf/shared';
import { categoryStyle, channelStyle } from '../../lib/categoryStyle';
import { dateTime } from '../../lib/format';
import { Card } from '../atoms/Card';
import { Chip } from '../atoms/Chip';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 text-[13px]">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

/** The ticket's details, as the requester may see them (no priority or assignee). */
export function TicketInfoCard({ ticket: t }: { ticket: AuthorTicket }) {
  const cat = categoryStyle(t.category);
  const channel = channelStyle(t.channel);
  return (
    <Card className="p-4">
      <p className="mb-1 text-[14px] font-bold">Details</p>
      <dl className="divide-y divide-line">
        <Row label="Ticket">{t.number}</Row>
        <Row label="Type">
          <Chip colors={cat.colors} icon={<cat.Icon size={12} aria-hidden />}>
            {cat.label}
          </Chip>
        </Row>
        <Row label="Book">{t.book?.title ?? 'Account level'}</Row>
        <Row label="Raised by">
          <span className="inline-flex items-center gap-1.5">
            <channel.Icon size={13} aria-hidden /> {channel.label}
          </span>
        </Row>
        <Row label="Opened">{dateTime(t.createdAt)}</Row>
        <Row label="Last update">{dateTime(t.updatedAt)}</Row>
      </dl>
    </Card>
  );
}
