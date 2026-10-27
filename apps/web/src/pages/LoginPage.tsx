import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { homeFor } from '../app/user';
import { Button } from '../components/atoms/Button';
import { Card } from '../components/atoms/Card';
import { Input } from '../components/atoms/Input';
import { AuthorSignInNote } from '../components/molecules/AuthorSignInNote';
import { DemoAccounts } from '../components/molecules/DemoAccounts';
import { Field } from '../components/molecules/Field';
import { useMe } from '../lib/queries';
import { useLogin } from '../lib/useLogin';

export function LoginPage() {
  const me = useMe();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, isSubmitting } = useLogin((user) =>
    navigate(homeFor(user), { replace: true }),
  );
  if (me.data) return <Navigate to={homeFor(me.data)} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void login(email, password);
  };

  return (
    <div className="grid h-full place-items-center overflow-y-auto p-4">
      <Card className="w-full max-w-[420px] p-7">
        <div className="mb-6 flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <div>
            <h1 className="font-serif text-[20px] font-semibold">BookLeaf Author Support</h1>
            <p className="text-[12.5px] text-ink-3">Support team sign-in</p>
          </div>
        </div>
        <AuthorSignInNote />
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
        <p className="mt-4 text-[12.5px] text-ink-3">
          New business?{' '}
          <Link to="/signup" className="font-semibold text-brand">
            Create a workspace
          </Link>
        </p>
        <DemoAccounts
          onPick={(pickedEmail) => {
            setEmail(pickedEmail);
            setPassword('');
          }}
        />
      </Card>
    </div>
  );
}
