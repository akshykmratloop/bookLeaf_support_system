import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Field } from './Field';
import type { SignInForm } from './useSignInForm';

const greeting = (h: number) =>
  h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

/** BookLeaf's sign-in, as a raised glass card. Demo accounts share HOST_DEMO_PASSWORD (README). */
export function SignInCard({ form }: { form: SignInForm }) {
  const { email, setEmail, password, setPassword, error, busy } = form;
  const [capsLock, setCapsLock] = useState(false);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    form.submitTyped();
  };
  const onKey = (e: KeyboardEvent) => setCapsLock(e.getModifierState('CapsLock'));
  return (
    <div className="relative w-full max-w-[420px] animate-rise">
      <span
        aria-hidden
        className="absolute -inset-6 rounded-[40px] bg-[conic-gradient(from_140deg,var(--brand-bright),var(--pink),var(--cream),var(--brand-bright))] opacity-40 blur-3xl"
      />
      <form
        onSubmit={onSubmit}
        className="relative flex flex-col gap-4 rounded-[28px] border border-white/70 bg-panel/75 dark:border-white/10 p-8 shadow-[0_1px_0_rgb(255_255_255/0.8)_inset,0_40px_90px_-30px_rgb(169_45_66/0.45),0_12px_30px_-16px_rgb(47_46_46/0.2)] backdrop-blur-2xl sm:p-10 dark:shadow-[0_1px_0_rgb(255_255_255/0.06)_inset,0_40px_90px_-30px_rgb(0_0_0/0.7)]"
      >
        <div className="mb-2">
          <p className="text-[13px] font-semibold text-brand-ink">
            {greeting(new Date().getHours())}
          </p>
          <h1 className="mt-1 text-[34px] leading-tight font-light tracking-tight">Welcome back</h1>
          <p className="mt-1 text-ink-2">Sign in to your author dashboard.</p>
        </div>
        <Field
          id="email"
          label="Email"
          icon={Mail}
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="password"
          label="Password"
          icon={Lock}
          type="password"
          revealable
          required
          maxLength={128}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyUp={onKey}
        />
        {capsLock ? (
          <p className="-mt-2 px-1 text-[12px] font-semibold text-warn">Caps Lock is on.</p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="animate-shake rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="group relative mt-2 flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full bg-[linear-gradient(135deg,var(--brand),var(--brand-deep))] text-[15px] font-semibold text-white shadow-[0_18px_40px_-14px_rgb(209_63_83/0.7)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-16px_rgb(209_63_83/0.8)] active:translate-y-0 disabled:opacity-60"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 -left-1/2 w-1/3 bg-[linear-gradient(100deg,transparent,rgb(255_255_255/0.35),transparent)] opacity-0 group-hover:animate-shimmer group-hover:opacity-100"
          />
          {busy ? 'Signing in…' : 'Sign in'}
          <ArrowRight
            size={17}
            aria-hidden
            className="transition-transform group-hover:translate-x-1"
          />
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[12px] text-ink-3">
          <ShieldCheck size={14} aria-hidden /> Help is one click away on every page.
        </p>
      </form>
    </div>
  );
}
