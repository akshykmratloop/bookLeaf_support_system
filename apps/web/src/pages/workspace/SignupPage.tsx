import { Rocket } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { homeFor } from '../../app/user';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { Input } from '../../components/atoms/Input';
import { Field } from '../../components/molecules/Field';
import { errorMessage, isApiError } from '../../lib/api';
import { useMe } from '../../lib/queries';
import { useLogin } from '../../lib/useLogin';
import { signup, slugFromName } from '../../lib/workspace';

interface Form {
  workspaceName: string;
  slug: string;
  ownerName: string;
  email: string;
  password: string;
}

const EMPTY: Form = { workspaceName: '', slug: '', ownerName: '', email: '', password: '' };

/** Any business creates its own workspace here, then configures everything from the UI. */
export function SignupPage() {
  const me = useMe();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const { login } = useLogin((user) => navigate(homeFor(user), { replace: true }));
  if (me.data) return <Navigate to={homeFor(me.data)} replace />;

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const fieldError = (path: string) => (isApiError(error) ? error.fieldError(path) : undefined);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(form);
      await login(form.email, form.password);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid h-full place-items-center overflow-y-auto p-4">
      <Card className="w-full max-w-[460px] p-7">
        <div className="mb-6 flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <div>
            <h1 className="font-serif text-[20px] font-semibold">Create your support workspace</h1>
            <p className="text-[12.5px] text-ink-3">
              Tickets, AI replies, chat and voice for your customers. Set up in minutes.
            </p>
          </div>
        </div>
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
          <Field
            id="workspaceName"
            label="Company or product name"
            error={fieldError('workspaceName')}
          >
            <Input
              id="workspaceName"
              value={form.workspaceName}
              onChange={(e) =>
                set({
                  workspaceName: e.target.value,
                  ...(slugEdited ? {} : { slug: slugFromName(e.target.value) }),
                })
              }
              required
            />
          </Field>
          <Field
            id="slug"
            label="Workspace id"
            hint="Lowercase letters, digits and hyphens. Your product sends it as the token issuer."
            error={fieldError('slug')}
          >
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => {
                setSlugEdited(true);
                set({ slug: e.target.value });
              }}
              required
            />
          </Field>
          <Field id="ownerName" label="Your name" error={fieldError('ownerName')}>
            <Input
              id="ownerName"
              autoComplete="name"
              value={form.ownerName}
              onChange={(e) => set({ ownerName: e.target.value })}
              required
            />
          </Field>
          <Field id="email" label="Work email" error={fieldError('email')}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              required
            />
          </Field>
          <Field
            id="password"
            label="Password"
            hint="At least 12 characters with a letter and a digit."
            error={
              fieldError('password') ??
              (error && !isApiError(error) ? errorMessage(error) : undefined)
            }
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
              required
            />
          </Field>
          {isApiError(error) && !error.problem.errors?.length ? (
            <p role="alert" className="text-[12.5px] text-danger">
              {error.problem.title}
            </p>
          ) : null}
          <Button type="submit" isLoading={isSubmitting} icon={<Rocket size={15} aria-hidden />}>
            Create workspace
          </Button>
        </form>
        <p className="mt-5 text-[12.5px] text-ink-3">
          Already have a workspace?{' '}
          <Link to="/login" className="font-semibold text-brand">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
