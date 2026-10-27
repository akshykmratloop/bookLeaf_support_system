/** The support team's demo account (listed in the README). Its password comes from build-time config, if provided. */
const ADMIN = { label: 'Neha Verma (Ops)', hint: 'Admin', email: 'admin@bookleaf.demo' };
const ADMIN_PASSWORD = import.meta.env.VITE_DEMO_ADMIN_PASSWORD ?? '';

/** One-click button that fills the sign-in form with the demo admin. */
export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="mb-3 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
        Demo account
      </p>
      <button
        type="button"
        onClick={() => onPick(ADMIN.email, ADMIN_PASSWORD)}
        className="w-full rounded-[9px] border border-line bg-inset px-3 py-2 text-left hover:border-brand"
      >
        <span className="block text-[12.5px] font-semibold">{ADMIN.label}</span>
        <span className="block text-[11px] text-ink-3">{ADMIN.hint}</span>
      </button>
      {!ADMIN_PASSWORD ? (
        <p className="mt-3 text-[11.5px] text-ink-3">The demo password is listed in the README.</p>
      ) : null}
    </div>
  );
}
