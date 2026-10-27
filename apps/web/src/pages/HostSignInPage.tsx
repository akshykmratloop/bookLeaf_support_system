import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { homeFor } from '../app/user';
import { Card } from '../components/atoms/Card';
import { LoadingState } from '../components/molecules/States';
import { useHostSignIn } from '../lib/useHostSignIn';

/** Where the host product sends an author: `/auth/host#t=<hand-over token>`. */
export function HostSignInPage() {
  const navigate = useNavigate();
  const { user, error } = useHostSignIn();
  useEffect(() => {
    if (user) navigate(homeFor(user), { replace: true });
  }, [user, navigate]);
  return (
    <div className="grid h-full place-items-center p-4">
      <Card className="w-full max-w-[420px] p-7">
        {error ? (
          <p role="alert" className="text-[13.5px]">
            {error} Please open support again from your BookLeaf account.
          </p>
        ) : (
          <LoadingState label="Signing you in…" />
        )}
      </Card>
    </div>
  );
}
