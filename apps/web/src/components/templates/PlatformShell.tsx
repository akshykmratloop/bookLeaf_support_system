import type { PlatformAdmin } from '@bookleaf/shared';
import { Building2, Cpu, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { applyTheme, readTheme, type Theme } from '../../lib/theme';

const NAV = [
  { to: '/platform', label: 'Customers', icon: <Building2 size={16} aria-hidden />, end: true },
  { to: '/platform/ai', label: 'AI & keys', icon: <Cpu size={16} aria-hidden />, end: false },
];

/** A row of tabs when narrow, a column in the rail when wide. */
function Rail() {
  return (
    <nav aria-label="Console" className="flex gap-1 md:flex-col">
      {NAV.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.end}
          className="pf-rail-link flex h-9 items-center gap-2.5 rounded-control px-3 text-[13px] font-medium"
        >
          {i.icon}
          {i.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand text-white">
        <ShieldCheck size={17} aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-[14px] font-bold tracking-tight">Support Console</p>
        <p className="font-mono text-[10.5px] tracking-[0.12em] text-[var(--pf-rail-dim)] uppercase">
          provider admin
        </p>
      </div>
    </div>
  );
}

interface Props {
  admin: PlatformAdmin;
  onSignOut: () => void;
  children: ReactNode;
}

/** The console's fixed frame: a graphite rail and header that never move; only <main> scrolls. */
export function PlatformShell({ admin, onSignOut, children }: Props) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };
  const themeLabel = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
  return (
    <div className="platform-theme flex h-screen flex-col overflow-hidden md:flex-row">
      <aside className="pf-rail flex shrink-0 flex-wrap items-center gap-3 px-4 py-3 md:h-screen md:w-[232px] md:flex-col md:flex-nowrap md:items-stretch md:gap-8 md:p-5">
        <div className="min-w-0 flex-1 md:flex-none">
          <Brand />
        </div>
        <div className="order-last w-full md:order-none md:w-auto md:flex-1">
          <Rail />
        </div>
        <div className="hidden border-t border-white/10 pt-4 text-[12px] md:block">
          <p className="truncate font-semibold">{admin.name}</p>
          <p className="truncate text-[var(--pf-rail-dim)]">{admin.email}</p>
        </div>
        <div className="flex items-center gap-1 md:-mx-1">
          <button
            type="button"
            onClick={toggle}
            aria-label={themeLabel}
            className="pf-rail-button grid h-9 w-9 place-items-center rounded-control"
          >
            {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="pf-rail-button flex h-9 items-center gap-2 rounded-control px-3 text-[12.5px] whitespace-nowrap"
          >
            <LogOut size={15} aria-hidden /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-none">
        <div className="mx-auto max-w-[1180px] px-4 pt-6 pb-16 md:px-8">{children}</div>
      </main>
    </div>
  );
}
