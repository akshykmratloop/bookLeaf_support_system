import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ToastProvider } from '../components/molecules/Toast';
import { isApiError } from '../lib/api';
import { AiSettingsPage } from '../pages/admin/AiSettingsPage';
import { AssistantSettingsPage } from '../pages/admin/AssistantSettingsPage';
import { QueuePage } from '../pages/admin/QueuePage';
import { TicketWorkspacePage } from '../pages/admin/TicketWorkspacePage';
import { AssistantPage } from '../pages/author/AssistantPage';
import { BooksPage } from '../pages/author/BooksPage';
import { ConversationPage } from '../pages/author/ConversationPage';
import { HistoryPage } from '../pages/author/HistoryPage';
import { NewTicketPage } from '../pages/author/NewTicketPage';
import { TicketDetailPage } from '../pages/author/TicketDetailPage';
import { TicketsPage } from '../pages/author/TicketsPage';
import { EmbedPage } from '../pages/embed/EmbedPage';
import { HostSignInPage } from '../pages/HostSignInPage';
import { LoginPage } from '../pages/LoginPage';
import { AuthedLayout, HomeRedirect } from './AuthedLayout';

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

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/host" element={<HostSignInPage />} />
            <Route path="/embed" element={<EmbedPage />} />
            <Route element={<AuthedLayout role="AUTHOR" />}>
              <Route path="/books" element={<BooksPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/new" element={<NewTicketPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:kind/:id" element={<ConversationPage />} />
            </Route>
            <Route element={<AuthedLayout role="ADMIN" />}>
              <Route path="/admin" element={<QueuePage />} />
              <Route path="/admin/tickets/:id" element={<TicketWorkspacePage />} />
              <Route path="/admin/ai" element={<AiSettingsPage />} />
              <Route path="/admin/assistant" element={<AssistantSettingsPage />} />
            </Route>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
