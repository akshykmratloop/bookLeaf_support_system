import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

interface Props {
  to: string;
  title: string;
  body: string;
  Icon: LucideIcon;
  /** Tailwind colour classes for the icon tile. */
  colors: string;
}

export function QuickAction({ to, title, body, Icon, colors }: Props) {
  return (
    <Link
      to={to}
      className="group flex animate-fade-up items-start gap-3 rounded-card border border-line bg-panel p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-control ${colors}`}>
        <Icon size={19} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold group-hover:text-brand-ink">{title}</span>
        <span className="block text-[12.5px] leading-snug text-ink-2">{body}</span>
      </span>
    </Link>
  );
}
