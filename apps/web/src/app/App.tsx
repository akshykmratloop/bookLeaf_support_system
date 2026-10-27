import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { ToastProvider } from '../components/molecules/Toast';
import { isApiError } from '../lib/api';
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

/** Old author addresses (before the author app moved under /embed) keep working. */
function ToAuthorApp({ to }: { to?: string }) {
  const { pathname, search } = useLocation();
  return <Navigate to={to ?? `/embed${pathname}${search}`} replace />;
}

/** The author's whole support app: the widget's frame, or full page from the host. */
const authorRoutes = (
  <Route path="/embed" element={<EmbedGate />}>
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
    <Route path="/books" element={<ToAuthorApp to="/embed" />} />
    <Route path="/assistant" element={<ToAuthorApp to="/embed/ask" />} />
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
            {authorRoutes}
            {oldAuthorRoutes}
            {adminRoutes}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
