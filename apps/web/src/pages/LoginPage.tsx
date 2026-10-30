import { Navigate, useNavigate } from 'react-router';
import { homeFor } from '../app/user';
import { DeskPanel } from '../components/organisms/DeskPanel';
import { StaffSignInForm } from '../components/organisms/StaffSignInForm';
import { useMe } from '../lib/queries';
import { useLogin } from '../lib/useLogin';

/**
 * Support staff sign-in (U-4): its own "support desk" look, split in two on wide screens (the
 * desk picture on the left, the form on the right) and the form alone on small ones.
 */
export function LoginPage() {
  const me = useMe();
  const navigate = useNavigate();
  const { login, error, isSubmitting } = useLogin((user) =>
    navigate(homeFor(user), { replace: true }),
  );
  if (me.data) return <Navigate to={homeFor(me.data)} replace />;

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto overscroll-none bg-app">
      <div className="grid min-h-full grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <DeskPanel />
        <main className="flex min-w-0 flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-[400px] animate-fade-up">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-[8px]" />
              <span className="text-[15px] font-bold tracking-tight">Support desk</span>
            </div>
            <p className="font-mono text-[11.5px] font-medium tracking-[0.14em] text-brand-ink uppercase">
              Staff sign-in
            </p>
            <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1.5 mb-7 text-[14px] text-ink-2">
              Sign in with your work email to open your team&apos;s queue.
            </p>
            <StaffSignInForm
              error={error}
              isSubmitting={isSubmitting}
              onSubmit={(email, password) => void login(email, password)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
