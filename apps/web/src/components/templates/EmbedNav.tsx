import { History, Home, LifeBuoy, MessageCircle, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { authorPaths } from '../../lib/paths';

interface Item {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
}

const ITEMS: Item[] = [
  { to: authorPaths.home, label: 'Home', Icon: Home, end: true },
  { to: authorPaths.ask, label: 'Ask', Icon: MessageCircle },
  { to: authorPaths.tickets, label: 'Tickets', Icon: LifeBuoy },
  { to: authorPaths.history, label: 'History', Icon: History },
];

const Badge = ({ count }: { count: number }) =>
  count > 0 ? (
    <span
      aria-label={`${count} need your reply`}
      className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[10.5px] font-bold text-white"
    >
      {count}
    </span>
  ) : null;

/** Tabs across the top in the small widget; a side rail when there is room. */
export function EmbedNav({ awaiting, rail }: { awaiting: number; rail: boolean }) {
  return (
    <nav
      aria-label="Help"
      className={rail ? 'flex flex-col gap-1' : 'flex gap-1 rounded-full bg-panel-2 p-1'}
    >
      {ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-2 font-semibold transition-colors ${
              rail
                ? 'h-11 rounded-control px-3 text-[14px]'
                : 'h-9 flex-1 justify-center rounded-full text-[12.5px]'
            } ${isActive ? 'bg-panel text-brand shadow-soft' : 'text-ink-2 hover:text-ink'}`
          }
        >
          <Icon size={rail ? 18 : 15} aria-hidden />
          {label}
          {to === authorPaths.tickets ? <Badge count={awaiting} /> : null}
        </NavLink>
      ))}
    </nav>
  );
}
