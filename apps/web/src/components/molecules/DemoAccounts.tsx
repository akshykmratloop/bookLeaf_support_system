/** The support team's demo account. Its password is in the README, never in the browser build. */
const ADMIN = { label: 'Neha Verma (Ops)', hint: 'Admin', email: 'admin@bookleaf.demo' };

/** One-click button that fills in the demo admin's email. */
export function DemoAccounts({ onPick }: { onPick: (email: string) => void }) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="mb-3 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
        Demo account
      </p>
      <button
        type="button"
        onClick={() => onPick(ADMIN.email)}
        className="w-full rounded-control border border-line bg-inset px-3 py-2 text-left hover:border-brand"
      >
        <span className="block text-[12.5px] font-semibold">{ADMIN.label}</span>
        <span className="block text-[11px] text-ink-3">{ADMIN.hint}</span>
      </button>
      <p className="mt-3 text-[11.5px] text-ink-3">The demo password is listed in the README.</p>
    </div>
  );
}
