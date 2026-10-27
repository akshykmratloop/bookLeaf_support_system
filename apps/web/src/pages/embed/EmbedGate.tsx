import type { AuthUser } from '@bookleaf/shared';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { SignedOutNote } from '../../components/molecules/SignedOutNote';
import { LoadingState } from '../../components/molecules/States';
import { EmbedShell } from '../../components/templates/EmbedShell';
import { isFramed, requestReauth } from '../../lib/frame';
import { useMe } from '../../lib/queries';
import { useHostSignIn } from '../../lib/useHostSignIn';

const hasHandOverToken = (hash: string) => new URLSearchParams(hash.replace(/^#/, '')).has('t');

function StaffNote() {
  return (
    <div className="grid h-full place-items-center p-6 text-center text-[13.5px] text-ink-2">
      <p>
        This help is for BookLeaf authors. Staff work in the{' '}
        <a href="/admin" className="font-semibold text-brand underline">
          support dashboard
        </a>
        .
      </p>
    </div>
  );
}

function Ready({ user }: { user: AuthUser }) {
  return user.role === 'AUTHOR' ? <EmbedShell user={user} /> : <StaffNote />;
}

/** Arrived with a hand-over token from the host (widget open, or a fresh sign-in). */
function TokenGate() {
  const { user, error } = useHostSignIn();
  if (error)
    return (
      <p role="alert" className="p-6 text-[13.5px]">
        {error} Please close help and open it again.
      </p>
    );
  return user ? <Ready user={user} /> : <LoadingState label="Opening help…" />;
}

/** Arrived without a token (a reload, a link inside the app): use the session cookie. */
function SessionGate() {
  const me = useMe();
  const { pathname } = useLocation();
  const missing = me.isError || (me.isSuccess && !me.data);
  useEffect(() => {
    if (missing) requestReauth(pathname);
  }, [missing, pathname]);
  if (me.data) return <Ready user={me.data} />;
  if (missing && !isFramed()) return <SignedOutNote />;
  return <LoadingState label={missing ? 'Reconnecting…' : 'Opening help…'} />;
}

/** The author's support app: in the widget's frame, or full page when the host links to it. */
export function EmbedGate() {
  const [withToken] = useState(() => hasHandOverToken(window.location.hash));
  return withToken ? <TokenGate /> : <SessionGate />;
}
