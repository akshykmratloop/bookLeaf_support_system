import type { AuthUser } from '@bookleaf/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';
import { signInWithHostToken, takeHostToken } from './hostSignIn';
import { keys } from './queries';

interface HostSignIn {
  user: AuthUser | null;
  /** The workspace the user signed into (its app is `/embed/<slug>`). */
  workspaceSlug: string | null;
  error: string | null;
}

const START: HostSignIn = { user: null, workspaceSlug: null, error: null };

/**
 * Exchanges the host's hand-over token in the URL fragment for a session, once. A widget page
 * passes its workspace, so a token for another workspace is refused.
 */
export function useHostSignIn(workspace?: string): HostSignIn {
  const qc = useQueryClient();
  const [state, setState] = useState<HostSignIn>(START);
  // The server accepts each token once: exchange it once, even if React runs the effect twice.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    signInWithHostToken(takeHostToken(window.location), workspace)
      .then(({ user, workspace: signedInto }) => {
        qc.setQueryData(keys.me, user);
        setState({ user, workspaceSlug: signedInto.slug, error: null });
      })
      .catch((err: unknown) => setState({ ...START, error: errorMessage(err) }));
  }, [qc, workspace]);
  return state;
}
