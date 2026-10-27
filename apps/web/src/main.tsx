import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { isFramed } from './lib/frame';
import { followHostTheme } from './lib/hostTheme';
import { applyTheme, readTheme, showTheme } from './lib/theme';
import './styles/index.css';

applyTheme(readTheme());
// Inside the widget, follow the host page's light or dark theme (before the token is read).
if (isFramed()) followHostTheme(window, showTheme);

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
