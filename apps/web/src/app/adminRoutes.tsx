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

const ConnectorPage = lazyPage(() =>
  import('../pages/workspace/ConnectorPage').then((m) => m.ConnectorPage),
);
const FieldsPage = lazyPage(() =>
  import('../pages/workspace/FieldsPage').then((m) => m.FieldsPage),
);
const CategoriesPage = lazyPage(() =>
  import('../pages/workspace/CategoriesPage').then((m) => m.CategoriesPage),
);
const KnowledgePage = lazyPage(() =>
  import('../pages/workspace/KnowledgePage').then((m) => m.KnowledgePage),
);
const WorkspaceSettingsPage = lazyPage(() =>
  import('../pages/workspace/WorkspaceSettingsPage').then((m) => m.WorkspaceSettingsPage),
);
const ApiKeysPage = lazyPage(() =>
  import('../pages/workspace/ApiKeysPage').then((m) => m.ApiKeysPage),
);
const WebhooksPage = lazyPage(() =>
  import('../pages/workspace/WebhooksPage').then((m) => m.WebhooksPage),
);

const loading = (page: ReactNode) => <Suspense fallback={<LoadingState />}>{page}</Suspense>;

/** The staff and workspace-owner screens, behind the admin sign-in, each loaded on first use. */
export const adminRoutes = (
  <Route element={<AuthedLayout role="ADMIN" />}>
    <Route path="/admin" element={loading(<QueuePage />)} />
    <Route path="/admin/tickets/:id" element={loading(<TicketWorkspacePage />)} />
    <Route path="/admin/ai" element={loading(<AiSettingsPage />)} />
    <Route path="/admin/assistant" element={loading(<AssistantSettingsPage />)} />
    <Route path="/admin/workspace/connection" element={loading(<ConnectorPage />)} />
    <Route path="/admin/workspace/fields" element={loading(<FieldsPage />)} />
    <Route path="/admin/workspace/categories" element={loading(<CategoriesPage />)} />
    <Route path="/admin/workspace/knowledge" element={loading(<KnowledgePage />)} />
    <Route path="/admin/workspace/settings" element={loading(<WorkspaceSettingsPage />)} />
    <Route path="/admin/workspace/api-keys" element={loading(<ApiKeysPage />)} />
    <Route path="/admin/workspace/webhooks" element={loading(<WebhooksPage />)} />
  </Route>
);
