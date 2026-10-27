import type { Dashboard } from '@bookleaf/host-demo/dashboard';
import { CalendarDays, Mail, MapPin, Phone } from 'lucide-react';
import { day } from '../lib/format';
import { Card } from './Card';

export function AccountCard({ profile }: { profile: Dashboard['profile'] }) {
  const rows = [
    { Icon: Mail, label: 'Email', value: profile.email },
    { Icon: Phone, label: 'Phone', value: profile.phone },
    { Icon: MapPin, label: 'City', value: profile.city },
    { Icon: CalendarDays, label: 'Author since', value: day(profile.memberSince) },
  ];
  return (
    <Card title="Your account" subtitle={`Author ID ${profile.id}`}>
      <dl className="flex flex-col gap-3">
        {rows.map(({ Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-panel-2 text-ink-2">
              <Icon size={15} aria-hidden />
            </span>
            <div className="min-w-0">
              <dt className="text-[11.5px] text-ink-3">{label}</dt>
              <dd className="truncate text-[13.5px] font-semibold">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </Card>
  );
}
