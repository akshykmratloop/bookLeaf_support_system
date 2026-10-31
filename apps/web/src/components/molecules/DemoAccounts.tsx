import { LogIn } from 'lucide-react';
import { DEMO_ADMIN, type DemoStaffAccount } from '../../lib/demoAccounts';
import { Spinner } from '../atoms/Spinner';

interface Props {
  isSubmitting: boolean;
  onPick: (account: DemoStaffAccount) => void;
  account?: DemoStaffAccount;
}

/** One click signs in as the demo admin: it fills the form above and submits it. */
export function DemoAccounts({ isSubmitting, onPick, account = DEMO_ADMIN }: Props) {
  return (
    <div className="border-t border-line pt-5">
      <p className="mb-3 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
        Demo account
      </p>
      <button
        type="button"
        onClick={() => onPick(account)}
        disabled={isSubmitting}
        aria-busy={isSubmitting || undefined}
        className="flex w-full items-center gap-3 rounded-control border border-line-strong bg-panel px-4 py-3 text-left shadow-soft transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand-ink">
          {isSubmitting ? <Spinner size={14} /> : <LogIn size={16} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold">
            Sign in as BookLeaf admin (demo)
          </span>
          <span className="block truncate text-[12px] text-ink-2">
            {account.name} · {account.email}
          </span>
        </span>
      </button>
      <p className="mt-3 text-[11.5px] text-ink-3">
        A published demo login from the README: it fills in the form above and signs in.
      </p>
    </div>
  );
}
