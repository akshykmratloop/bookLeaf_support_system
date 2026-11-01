import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { Field } from '../../components/molecules/Field';
import { PasswordField } from '../../components/molecules/PasswordField';
import { errorMessage } from '../../lib/api';
import { platformKeys, platformSignIn, usePlatformMe } from '../../lib/platform';

const POINTS = [
  'AI providers, keys and models for every customer',
  'Plans, limits and suspension per customer',
  'Usage and cost — never ticket content',
];

function Intro() {
  return (
    <div className="pf-rail hidden flex-col justify-between rounded-l-[20px] p-8 md:flex">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-brand text-white">
          <ShieldCheck size={18} aria-hidden />
        </span>
        <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--pf-rail-dim)] uppercase">
          support provider
        </p>
      </div>
      <div>
        <h2 className="text-[26px] leading-tight font-bold tracking-tight">The control room</h2>
        <ul className="mt-5 flex flex-col gap-3 text-[13px] text-[var(--pf-rail-dim)]">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-2.5">
              <span
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-bright"
                aria-hidden
              />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <p className="font-mono text-[11px] text-[var(--pf-rail-dim)]">
        Accounts are created on deploy.
      </p>
    </div>
  );
}

/** /platform/login: the super admin's own sign-in, deliberately unlike any customer screen. */
export function PlatformLoginPage() {
  const me = usePlatformMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (me.data) return <Navigate to="/platform" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { admin } = await platformSignIn(email, password);
      qc.setQueryData(platformKeys.me, admin);
      navigate('/platform', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="platform-theme pf-grid grid h-full place-items-center overflow-y-auto p-4">
      <div className="grid w-full max-w-[880px] overflow-hidden rounded-[20px] border border-line bg-panel shadow-float md:grid-cols-[1fr_1.05fr]">
        <Intro />
        <form
          onSubmit={(e) => void submit(e)}
          className="flex flex-col gap-5 p-7 sm:p-10"
          noValidate
        >
          <div>
            <p className="font-mono text-[11px] tracking-[0.14em] text-brand-ink uppercase">
              /platform
            </p>
            <h1 className="mt-1 text-[24px] font-bold tracking-tight">Sign in to the console</h1>
            <p className="mt-1 text-[13px] text-ink-2">
              For the support provider’s operators only.
            </p>
          </div>
          <Field id="platform-email" label="Email">
            <Input
              id="platform-email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <PasswordField
            id="platform-password"
            name="password"
            value={password}
            onChange={setPassword}
            error={error ?? undefined}
          />
          <Button
            type="submit"
            size="lg"
            isLoading={busy}
            disabled={!email || !password}
            icon={<ArrowRight size={16} aria-hidden />}
          >
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
