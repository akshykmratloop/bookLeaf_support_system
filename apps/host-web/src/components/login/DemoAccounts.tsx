import { DEMO_AUTHORS, type DemoAuthor } from '../../lib/demoAccounts';
import { DemoAccountChip } from './DemoAccountChip';

interface Props {
  busy: boolean;
  /** The demo author being signed in, or null. */
  activeEmail: string | null;
  onPick: (account: DemoAuthor) => void;
  accounts?: readonly DemoAuthor[];
}

/** Every demo author, one click each: the click fills the sign-in form and submits it. */
export function DemoAccounts({ busy, activeEmail, onPick, accounts = DEMO_AUTHORS }: Props) {
  return (
    <section
      aria-labelledby="demo-accounts-title"
      className="animate-rise rounded-[28px] border border-white/70 bg-panel/60 p-6 shadow-card backdrop-blur-xl sm:p-8 dark:border-white/10"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="demo-accounts-title" className="text-[18px] font-semibold tracking-tight">
          Try it as an author — one click
        </h2>
        <p className="text-[12px] text-ink-3">
          Demo accounts from the README. Each one fills in the form and signs in.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {accounts.map((account) => (
          <li key={account.email} className="min-w-0">
            <DemoAccountChip
              account={account}
              disabled={busy}
              inProgress={busy && activeEmail === account.email}
              onPick={onPick}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
