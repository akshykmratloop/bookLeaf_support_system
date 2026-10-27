import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { isSignedOut } from './lib/api';
import { applyTheme, readTheme } from './lib/theme';
import './styles.css';

applyTheme(readTheme());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: (count, err) => !isSignedOut(err) && count < 2, staleTime: 30_000 },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
