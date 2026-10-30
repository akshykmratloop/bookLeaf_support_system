import { lazy, Suspense, type ReactNode } from 'react';
import { Route } from 'react-router';
import { LoadingState } from '../components/molecules/States';
import { PlatformLayout } from './PlatformLayout';

const LoginPage = lazy(() =>
  import('../pages/platform/PlatformLoginPage').then((m) => ({ default: m.PlatformLoginPage })),
);
const CustomersPage = lazy(() =>
  import('../pages/platform/CustomersPage').then((m) => ({ default: m.CustomersPage })),
);
const CustomerPage = lazy(() =>
  import('../pages/platform/CustomerPage').then((m) => ({ default: m.CustomerPage })),
);
const AiPage = lazy(() =>
  import('../pages/platform/PlatformAiPage').then((m) => ({ default: m.PlatformAiPage })),
);

const loading = (page: ReactNode) => <Suspense fallback={<LoadingState />}>{page}</Suspense>;

/** The super admin console (U-7): its own sign-in and screens, loaded only when opened. */
export const platformRoutes = (
  <>
    <Route path="/platform/login" element={loading(<LoginPage />)} />
    <Route element={<PlatformLayout />}>
      <Route path="/platform" element={loading(<CustomersPage />)} />
      <Route path="/platform/customers/:id" element={loading(<CustomerPage />)} />
      <Route path="/platform/ai" element={loading(<AiPage />)} />
    </Route>
  </>
);
