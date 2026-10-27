import { useQuery } from '@tanstack/react-query';
import { getDashboard, isSignedOut } from './lib/api';
import { DASHBOARD_KEY } from './lib/keys';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { Loading, Problem } from './components/States';

/** Signed in: the dashboard. Signed out: BookLeaf's own sign-in. */
export function App() {
  const dashboard = useQuery({ queryKey: DASHBOARD_KEY, queryFn: getDashboard });
  if (dashboard.isPending) return <Loading />;
  if (dashboard.isError && isSignedOut(dashboard.error)) return <LoginPage />;
  if (dashboard.isError)
    return <Problem message={dashboard.error.message} onRetry={() => void dashboard.refetch()} />;
  return <DashboardPage data={dashboard.data} />;
}
