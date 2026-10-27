import type { AuthUser } from '@bookleaf/shared';
import { useQueryClient } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { homeFor } from '../app/AuthedLayout';
import { Button } from '../components/atoms/Button';
import { Card } from '../components/atoms/Card';
import { Input } from '../components/atoms/Input';
import { Field } from '../components/molecules/Field';
import { api, errorMessage } from '../lib/api';
import { keys, useMe } from '../lib/queries';

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

export function LoginPage() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  if (me.data) return <Navigate to={homeFor(me.data)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await api<{ user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      qc.setQueryData(keys.me, user);
      navigate(homeFor(user), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid h-full place-items-center overflow-y-auto p-4">
      <Card className="w-full max-w-[420px] p-7">
        <div className="mb-6 flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <div>
            <h1 className="font-serif text-[20px] font-semibold">BookLeaf Author Support</h1>
            <p className="text-[12.5px] text-ink-3">Sign in to your account</p>
          </div>
        </div>
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
          <Field id="email" label="Email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field id="password" label="Password" error={error ?? undefined}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error)}
              required
            />
          </Field>
          <Button
            type="submit"
            isLoading={isSubmitting}
            icon={<LogIn size={15} aria-hidden />}
            disabled={!email || !password}
          >
            Sign in
          </Button>
        </form>
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
            Demo accounts
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(DEMO_PASSWORDS[d.role]);
                }}
                className="rounded-[9px] border border-line bg-inset px-3 py-2 text-left hover:border-brand"
              >
                <span className="block text-[12.5px] font-semibold">{d.label}</span>
                <span className="block text-[11px] text-ink-3">{d.hint}</span>
              </button>
            ))}
          </div>
          {!DEMO_PASSWORDS.author ? (
            <p className="mt-3 text-[11.5px] text-ink-3">
              Demo passwords are listed in the README.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
