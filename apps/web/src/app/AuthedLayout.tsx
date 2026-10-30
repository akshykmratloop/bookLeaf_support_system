import type { AuthUser, Role } from '@bookleaf/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router';
import { LoadingState } from '../components/molecules/States';
import { AppShell } from '../components/templates/AppShell';
import { api } from '../lib/api';
import { useLiveUpdates } from '../lib/live-updates';
import { useMe } from '../lib/queries';
import { homeFor } from './user';

function Shell({ user }: { user: AuthUser }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toLogin = useCallback(() => {
    qc.clear();
    navigate('/login', { replace: true });
  }, [qc, navigate]);
  const live = useLiveUpdates(toLogin);
  const signOut = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      toLogin();
    }
  };
  return (
    <AppShell user={user} live={live} onSignOut={() => void signOut()}>
      <Outlet context={user} />
    </AppShell>
  );
}

/** Route guard for the staff dashboard: others are sent to their own home (authors: /embed/<slug>). */
export function AuthedLayout({ role }: { role: Role }) {
  const me = useMe();
  if (me.isPending) return <LoadingState label="Signing you in…" />;
  if (me.isError || !me.data) return <Navigate to="/login" replace />;
  if (me.data.role !== role) return <Navigate to={homeFor(me.data)} replace />;
  return <Shell user={me.data} />;
}

export function HomeRedirect() {
  const me = useMe();
  if (me.isPending) return <LoadingState />;
  return <Navigate to={me.data ? homeFor(me.data) : '/login'} replace />;
}
