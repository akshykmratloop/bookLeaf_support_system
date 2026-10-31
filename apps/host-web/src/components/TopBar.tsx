import { LifeBuoy, LogOut, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { initials } from '../lib/format';
import { applyTheme, readTheme, type Theme } from '../lib/theme';
import { openHelp } from '../lib/useSupportWidget';
import { Logo } from './Logo';

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-panel-2 hover:text-ink"
    >
      {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}

export function TopBar({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-panel/80 px-4 backdrop-blur lg:px-8">
      <Logo />
      <span className="ml-2 hidden rounded-full bg-brand-soft px-2.5 py-1 text-[11.5px] font-bold text-brand-ink sm:inline">
        Author dashboard
      </span>
      <span className="flex-1" />
      <button
        type="button"
        onClick={() => openHelp()}
        className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-ink-2 hover:bg-panel-2 hover:text-ink"
      >
        <LifeBuoy size={16} aria-hidden /> Get help
      </button>
      <ThemeToggle />
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-full bg-brand text-[13px] font-bold text-white"
      >
        {initials(name)}
      </span>
      <button
        type="button"
        onClick={onSignOut}
        aria-label="Sign out"
        title="Sign out"
        className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-panel-2 hover:text-ink"
      >
        <LogOut size={16} aria-hidden />
      </button>
    </header>
  );
}
