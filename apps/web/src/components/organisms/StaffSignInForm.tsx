import { ArrowRight, Building2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { fillAndSubmit } from '../../lib/demoAccounts';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { DemoAccounts } from '../molecules/DemoAccounts';
import { Field } from '../molecules/Field';
import { PasswordField } from '../molecules/PasswordField';

interface Props {
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (email: string, password: string) => void;
}

function SignupLink() {
  return (
    <Link
      to="/signup"
      className="group flex items-center gap-3 rounded-control border border-line bg-panel px-4 py-3 transition-colors hover:border-brand/50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-navy-soft text-navy">
        <Building2 size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">New business?</span>
        <span className="block text-[12px] text-ink-2">Create a workspace for your team</span>
      </span>
      <ArrowRight
        size={16}
        aria-hidden
        className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink"
      />
    </Link>
  );
}

/**
 * Email + password for support staff; customers get help inside the product they use. The demo
 * admin button fills the same fields and submits through the same `onSubmit`.
 */
export function StaffSignInForm({ error, isSubmitting, onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(email, password);
  };
  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate aria-label="Sign in">
        <Field id="email" label="Work email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <PasswordField
          id="password"
          value={password}
          onChange={setPassword}
          error={error ?? undefined}
        />
        <Button
          type="submit"
          size="lg"
          className="mt-1 w-full"
          isLoading={isSubmitting}
          disabled={!email || !password}
          icon={<ArrowRight size={16} aria-hidden />}
        >
          Sign in
        </Button>
      </form>
      <DemoAccounts
        isSubmitting={isSubmitting}
        onPick={(account) => fillAndSubmit(account, { setEmail, setPassword, submit: onSubmit })}
      />
      <SignupLink />
      <p className="text-[12px] leading-relaxed text-ink-2">
        Need help as a customer or author? Open Help from inside the product you use: this page is
        for support teams only.
      </p>
    </div>
  );
}
