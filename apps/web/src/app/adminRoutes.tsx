import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Route } from 'react-router';
import { LoadingState } from '../components/molecules/States';
import { AuthedLayout } from './AuthedLayout';

const RELOADED = 'bookleaf.chunk-reload';

/**
 * Loads a page only when it is opened, so authors never download the staff screens. If the
 * file is gone (a new version was deployed since this tab loaded), the page reloads once.
 */
function lazyPage(load: () => Promise<ComponentType>) {
  return lazy(async () => {
    try {
      const Page = await load();
      sessionStorage.removeItem(RELOADED);
      return { default: Page };
    } catch (err) {
      if (sessionStorage.getItem(RELOADED)) throw err;
      sessionStorage.setItem(RELOADED, '1');
      window.location.reload();
      return { default: () => null };
    }
  });
}

const QueuePage = lazyPage(() => import('../pages/admin/QueuePage').then((m) => m.QueuePage));
const TicketWorkspacePage = lazyPage(() =>
  import('../pages/admin/TicketWorkspacePage').then((m) => m.TicketWorkspacePage),
);
const AiSettingsPage = lazyPage(() =>
  import('../pages/admin/AiSettingsPage').then((m) => m.AiSettingsPage),
);
const AssistantSettingsPage = lazyPage(() =>
  import('../pages/admin/AssistantSettingsPage').then((m) => m.AssistantSettingsPage),
);

const loading = (page: ReactNode) => <Suspense fallback={<LoadingState />}>{page}</Suspense>;

/** The staff screens, behind the admin sign-in, each loaded on first use. */
export const adminRoutes = (
  <Route element={<AuthedLayout role="ADMIN" />}>
    <Route path="/admin" element={loading(<QueuePage />)} />
    <Route path="/admin/tickets/:id" element={loading(<TicketWorkspacePage />)} />
    <Route path="/admin/ai" element={loading(<AiSettingsPage />)} />
    <Route path="/admin/assistant" element={loading(<AssistantSettingsPage />)} />
  </Route>
);
