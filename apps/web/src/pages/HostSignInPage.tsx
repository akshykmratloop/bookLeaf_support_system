import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { homeFor } from '../app/AuthedLayout';
import { Card } from '../components/atoms/Card';
import { LoadingState } from '../components/molecules/States';
import { errorMessage } from '../lib/api';
import { signInWithHostToken, takeHostToken } from '../lib/hostSignIn';
import { keys } from '../lib/queries';

/** Where the host product sends an author: `/auth/host#t=<hand-over token>`. */
export function HostSignInPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // The token is single-use: exchange it once, even if React runs the effect twice.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = takeHostToken(window.location);
    signInWithHostToken(token)
      .then((user) => {
        qc.setQueryData(keys.me, user);
        navigate(homeFor(user), { replace: true });
      })
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [qc, navigate]);
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
