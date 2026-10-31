import { LoaderCircle } from 'lucide-react';
import type { DemoAuthor } from '../../lib/demoAccounts';
import { initials } from '../../lib/format';

interface Props {
  account: DemoAuthor;
  disabled: boolean;
  /** This author is the one being signed in right now. */
  inProgress: boolean;
  onPick: (account: DemoAuthor) => void;
}

const hintId = (email: string) => `demo-hint-${email.split('@')[0] ?? email}`;

/** One demo author as a compact profile card; a click signs in as them. */
export function DemoAccountChip({ account, disabled, inProgress, onPick }: Props) {
  return (
    <button
      type="button"
      onClick={() => onPick(account)}
      disabled={disabled}
      aria-label={`Sign in as ${account.name}`}
      aria-describedby={hintId(account.email)}
      aria-busy={inProgress || undefined}
      className="flex h-full w-full min-w-0 items-center gap-3 rounded-2xl border border-line bg-panel/90 p-3 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand/50 focus-visible:ring-4 focus-visible:ring-brand/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:border-line"
    >
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--brand),var(--brand-deep))] text-[13px] font-bold text-white"
      >
        {inProgress ? <LoaderCircle size={16} className="animate-spin" /> : initials(account.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">{account.name}</span>
        <span className="block truncate text-[12px] text-ink-2">{account.email}</span>
        <span
          id={hintId(account.email)}
          className="mt-1 block text-[11.5px] leading-snug font-semibold text-brand-ink"
        >
          {inProgress ? 'Signing in…' : account.hint}
        </span>
      </span>
    </button>
  );
}
