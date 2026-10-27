import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyTheme, readTheme } from './lib/theme';
import './styles/index.css';

applyTheme(readTheme());

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
