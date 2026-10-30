import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useNavigate } from 'react-router';
import { LoadingState } from '../components/molecules/States';
import { PlatformShell } from '../components/templates/PlatformShell';
import { platformKeys, platformSignOut, usePlatformMe } from '../lib/platform';

/** Route guard for the console: only a super admin session gets in (the server enforces it too). */
export function PlatformLayout() {
  const me = usePlatformMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  if (me.isPending) return <LoadingState label="Opening the console…" />;
  if (me.isError || !me.data) return <Navigate to="/platform/login" replace />;
  const signOut = async () => {
    try {
      await platformSignOut();
    } finally {
      qc.removeQueries({ queryKey: ['platform'] });
      qc.setQueryData(platformKeys.me, undefined);
      navigate('/platform/login', { replace: true });
    }
  };
  return (
    <PlatformShell admin={me.data} onSignOut={() => void signOut()}>
      <Outlet />
    </PlatformShell>
  );
}
