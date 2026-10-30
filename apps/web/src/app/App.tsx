import { DEFAULT_WORKSPACE_SLUG, LEGACY_EMBED_SECTIONS } from '@bookleaf/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { ToastProvider } from '../components/molecules/Toast';
import { isApiError } from '../lib/api';
import { authorPathsFor, legacyAuthorPath } from '../lib/paths';
import { AssistantPage } from '../pages/author/AssistantPage';
import { ConversationPage } from '../pages/author/ConversationPage';
import { HistoryPage } from '../pages/author/HistoryPage';
import { NewTicketPage } from '../pages/author/NewTicketPage';
import { TicketDetailPage } from '../pages/author/TicketDetailPage';
import { TicketsPage } from '../pages/author/TicketsPage';
import { EmbedGate } from '../pages/embed/EmbedGate';
import { EmbedHomePage } from '../pages/embed/EmbedHomePage';
import { HostSignInPage } from '../pages/HostSignInPage';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/workspace/SignupPage';
import { adminRoutes } from './adminRoutes';
import { platformRoutes } from './platformRoutes';
import { HomeRedirect } from './AuthedLayout';

const MAX_RETRIES = 2;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      // Client errors (401/403/404/422) will not fix themselves; only retry network and 5xx.
      retry: (count, err) =>
        !(isApiError(err) && err.status >= 400 && err.status < 500) && count < MAX_RETRIES,
    },
  },
});

const BOOKLEAF = authorPathsFor(DEFAULT_WORKSPACE_SLUG);

/** Old author addresses (before the author app moved under /embed) keep working. */
function ToAuthorApp({ to }: { to?: string }) {
  const { pathname, search } = useLocation();
  return <Navigate to={to ?? `${legacyAuthorPath(`/embed${pathname}`)}${search}`} replace />;
}

/**
 * The old shared widget address (`/embed`, `/embed/tickets/…`) opens BookLeaf's app. The hash
 * is kept: it carries the host's hand-over token. In production the API redirects first.
 */
function ToDefaultWorkspace() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`${legacyAuthorPath(pathname)}${search}${hash}`} replace />;
}

const legacyEmbedRoutes = (
  <>
    <Route path="/embed" element={<ToDefaultWorkspace />} />
    {LEGACY_EMBED_SECTIONS.map((section) => (
      <Route key={section} path={`/embed/${section}/*`} element={<ToDefaultWorkspace />} />
    ))}
  </>
);

/** One workspace's author app (`/embed/<slug>`): the widget's frame, or full page from the host. */
const authorRoutes = (
  <Route path="/embed/:workspace" element={<EmbedGate />}>
    <Route index element={<EmbedHomePage />} />
    <Route path="ask" element={<AssistantPage />} />
    <Route path="tickets" element={<TicketsPage />} />
    <Route path="tickets/new" element={<NewTicketPage />} />
    <Route path="tickets/:id" element={<TicketDetailPage />} />
    <Route path="history" element={<HistoryPage />} />
    <Route path="history/:kind/:id" element={<ConversationPage />} />
  </Route>
);

const oldAuthorRoutes = (
  <>
    <Route path="/books" element={<ToAuthorApp to={BOOKLEAF.home} />} />
    <Route path="/assistant" element={<ToAuthorApp to={BOOKLEAF.ask} />} />
    <Route path="/tickets/*" element={<ToAuthorApp />} />
    <Route path="/history/*" element={<ToAuthorApp />} />
  </>
);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/auth/host" element={<HostSignInPage />} />
            {legacyEmbedRoutes}
            {authorRoutes}
            {oldAuthorRoutes}
            {adminRoutes}
            {platformRoutes}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
