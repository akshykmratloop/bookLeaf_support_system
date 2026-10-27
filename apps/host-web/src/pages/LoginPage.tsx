import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Logo } from '../components/Logo';
import { signIn } from '../lib/api';
import { DASHBOARD_KEY } from '../lib/keys';

const field =
  'h-11 w-full rounded-xl border border-line bg-panel px-3.5 text-[14px] focus:border-brand focus:outline-none';

/** BookLeaf's own sign-in. Demo accounts share HOST_DEMO_PASSWORD (see the README). */
export function LoginPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('priya.sharma@email.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      await qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid h-full overflow-y-auto lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-brand to-[#0b5e3b] p-12 text-white lg:flex">
        <Logo size="lg" />
        <div>
          <p className="font-serif text-[40px] leading-tight italic">Your books, your royalties,</p>
          <p className="font-serif text-[40px] leading-tight italic">all in one place.</p>
          <p className="mt-4 max-w-md text-white/80">
            See sales, payouts and production at a glance, and get help without leaving the page.
          </p>
        </div>
        <p className="text-[12px] text-white/60">A demo of BookLeaf's author platform.</p>
      </section>
      <section className="grid place-items-center p-6">
        <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-[26px] font-extrabold">Welcome back</h1>
          <p className="mb-6 text-ink-2">Sign in to your author dashboard.</p>
          <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
          <label htmlFor="password" className="mt-4 mb-1.5 block text-[13px] font-semibold">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand font-semibold text-white shadow-card hover:bg-brand-strong disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} aria-hidden />
          </button>
        </form>
      </section>
    </div>
  );
}
