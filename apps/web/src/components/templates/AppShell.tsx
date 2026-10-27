import type { AuthUser } from '@bookleaf/shared';
import {
  BookOpen,
  Bot,
  Inbox,
  LifeBuoy,
  LogOut,
  MessagesSquare,
  History,
  Moon,
  PlusCircle,
  Sun,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import type { LiveState } from '../../lib/live-updates';
import { applyTheme, readTheme, type Theme } from '../../lib/theme';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const AUTHOR_NAV: NavItem[] = [
  { to: '/books', label: 'My Books', icon: <BookOpen size={16} aria-hidden /> },
  { to: '/tickets', label: 'My Tickets', icon: <LifeBuoy size={16} aria-hidden />, end: true },
  { to: '/tickets/new', label: 'New Ticket', icon: <PlusCircle size={16} aria-hidden /> },
];
const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Ticket Queue', icon: <Inbox size={16} aria-hidden />, end: true },
  { to: '/admin/ai', label: 'AI Settings', icon: <Bot size={16} aria-hidden /> },
  {
    to: '/admin/assistant',
    label: 'Author Assistant',
    icon: <MessagesSquare size={16} aria-hidden />,
  },
];
const ASSISTANT_NAV: NavItem[] = [
  { to: '/assistant', label: 'Ask BookLeaf', icon: <MessagesSquare size={16} aria-hidden /> },
  { to: '/history', label: 'History', icon: <History size={16} aria-hidden /> },
];

const LIVE_TEXT: Record<LiveState, string> = {
  connecting: 'Connecting…',
  live: 'Live updates on',
  polling: 'Refreshing every 15 s',
};

const navClass = (isActive: boolean) =>
  `flex h-9 items-center gap-2.5 rounded-[9px] px-3 text-[13px] font-medium ${
    isActive ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-panel-2 hover:text-ink'
  }`;

function NavItems({ items, compact = false }: { items: NavItem[]; compact?: boolean }) {
  return (
    <nav
      aria-label="Main"
      className={compact ? 'flex gap-1 overflow-x-auto' : 'flex flex-col gap-1'}
    >
      {items.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.end}
          aria-label={compact ? i.label : undefined}
          className={({ isActive }) => navClass(isActive)}
        >
          {i.icon}
          {compact ? null : i.label}
        </NavLink>
      ))}
    </nav>
  );
}

interface Props {
  user: AuthUser;
  live: LiveState;
  onSignOut: () => void;
  /** Show the author's "Ask BookLeaf" entry (an admin has switched an assistant channel on). */
  showAssistant?: boolean;
  children: ReactNode;
}

/** Fixed frame: sidebar and header never move; only <main> scrolls. */
export function AppShell({ user, live, onSignOut, showAssistant = false, children }: Props) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const nav =
    user.role === 'ADMIN'
      ? ADMIN_NAV
      : showAssistant
        ? [...AUTHOR_NAV, ...ASSISTANT_NAV]
        : AUTHOR_NAV;
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden h-screen w-[248px] shrink-0 flex-col gap-6 border-r border-line bg-sidebar p-4 md:flex">
        <div className="flex items-center gap-2 px-2 pt-1">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <div>
            <p className="font-serif text-[16px] leading-none font-semibold">BookLeaf</p>
            <p className="text-[11px] text-ink-3">
              {user.role === 'ADMIN' ? 'Operations' : 'Author Support'}
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavItems items={nav} />
        </div>
        <div className="border-t border-line pt-4 text-[12.5px]">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-ink-3">{user.email}</p>
        </div>
      </aside>
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-app/80 px-4 backdrop-blur md:px-7">
          <div className="min-w-0 md:hidden">
            <NavItems items={nav} compact />
          </div>
          <p
            className="hidden items-center gap-2 text-[12px] text-ink-3 md:flex"
            aria-live="polite"
          >
            <span
              className={`h-2 w-2 rounded-full ${live === 'live' ? 'bg-success' : 'bg-warning'}`}
              aria-hidden
            />
            {LIVE_TEXT[live]}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="grid h-9 w-9 place-items-center rounded-[9px] text-ink-2 hover:bg-panel-2"
            >
              {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="flex h-9 items-center gap-2 rounded-[9px] px-3 text-[12.5px] text-ink-2 hover:bg-panel-2"
            >
              <LogOut size={15} aria-hidden /> Sign out
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-none">
          <div className="mx-auto max-w-[1320px] px-4 pt-6 pb-16 md:px-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
