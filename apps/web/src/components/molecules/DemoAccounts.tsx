/** Public demo accounts (listed in the README). Passwords come from build-time config, if provided. */
const DEMO = [
  {
    label: 'Priya Sharma',
    hint: 'Royalties pending',
    email: 'priya.sharma@email.com',
    role: 'author',
  },
  {
    label: 'Arjun Malhotra',
    hint: 'No payout yet',
    email: 'arjun.malhotra@email.com',
    role: 'author',
  },
  {
    label: 'Kavita Deshmukh',
    hint: 'Below threshold · book in production',
    email: 'kavita.deshmukh@email.com',
    role: 'author',
  },
  { label: 'Neha Verma (Ops)', hint: 'Admin', email: 'admin@bookleaf.demo', role: 'admin' },
] as const;
const DEMO_PASSWORDS = {
  author: import.meta.env.VITE_DEMO_AUTHOR_PASSWORD ?? '',
  admin: import.meta.env.VITE_DEMO_ADMIN_PASSWORD ?? '',
};

/** One-click buttons that fill the sign-in form with a demo account. */
export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="mb-3 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
        Demo accounts
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DEMO.map((d) => (
          <button
            key={d.email}
            type="button"
            onClick={() => onPick(d.email, DEMO_PASSWORDS[d.role])}
            className="rounded-[9px] border border-line bg-inset px-3 py-2 text-left hover:border-brand"
          >
            <span className="block text-[12.5px] font-semibold">{d.label}</span>
            <span className="block text-[11px] text-ink-3">{d.hint}</span>
          </button>
        ))}
      </div>
      {!DEMO_PASSWORDS.author ? (
        <p className="mt-3 text-[11.5px] text-ink-3">Demo passwords are listed in the README.</p>
      ) : null}
    </div>
  );
}
