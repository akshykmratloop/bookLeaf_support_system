import type { AuthUser } from '@bookleaf/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';
import { signInWithHostToken, takeHostToken } from './hostSignIn';
import { keys } from './queries';

interface HostSignIn {
  user: AuthUser | null;
  error: string | null;
}

/** Exchanges the host's hand-over token in the URL fragment for a session, once. */
export function useHostSignIn(): HostSignIn {
  const qc = useQueryClient();
  const [state, setState] = useState<HostSignIn>({ user: null, error: null });
  // The server accepts each token once: exchange it once, even if React runs the effect twice.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    signInWithHostToken(takeHostToken(window.location))
      .then((user) => {
        qc.setQueryData(keys.me, user);
        setState({ user, error: null });
      })
      .catch((err: unknown) => setState({ user: null, error: errorMessage(err) }));
  }, [qc]);
  return state;
}
