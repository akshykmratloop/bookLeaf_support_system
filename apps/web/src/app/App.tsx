import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ToastProvider } from '../components/molecules/Toast';
import { isApiError } from '../lib/api';
import { AiSettingsPage } from '../pages/admin/AiSettingsPage';
import { QueuePage } from '../pages/admin/QueuePage';
import { TicketWorkspacePage } from '../pages/admin/TicketWorkspacePage';
import { BooksPage } from '../pages/author/BooksPage';
import { NewTicketPage } from '../pages/author/NewTicketPage';
import { TicketDetailPage } from '../pages/author/TicketDetailPage';
import { TicketsPage } from '../pages/author/TicketsPage';
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
            <Route element={<AuthedLayout role="AUTHOR" />}>
              <Route path="/books" element={<BooksPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/new" element={<NewTicketPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
            </Route>
            <Route element={<AuthedLayout role="ADMIN" />}>
              <Route path="/admin" element={<QueuePage />} />
              <Route path="/admin/tickets/:id" element={<TicketWorkspacePage />} />
              <Route path="/admin/ai" element={<AiSettingsPage />} />
            </Route>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
