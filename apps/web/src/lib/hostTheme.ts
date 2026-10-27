import type { Theme } from './theme';

/** Sent by public/embed.js whenever the host page switches between light and dark. */
const THEME_MESSAGE = 'bookleaf-support:theme';

const asTheme = (value: unknown): Theme | null =>
  value === 'dark' || value === 'light' ? value : null;

/** The host page's theme, passed in the frame address (`#t=…&theme=dark`). */
export const themeFromHash = (hash: string): Theme | null =>
  asTheme(new URLSearchParams(hash.replace(/^#/, '')).get('theme'));

/**
 * Inside the widget, the host page decides light or dark: first from the frame address, then
 * from its messages. Only the parent window is listened to, and only the two known values.
 */
export function followHostTheme(win: Window, set: (theme: Theme) => void): () => void {
  const first = themeFromHash(win.location.hash);
  if (first) set(first);
  const onMessage = (e: MessageEvent) => {
    if (e.source !== win.parent) return;
    const data = e.data as { type?: unknown; theme?: unknown } | null;
    if (data?.type !== THEME_MESSAGE) return;
    const theme = asTheme(data.theme);
    if (theme) set(theme);
  };
  win.addEventListener('message', onMessage);
  return () => win.removeEventListener('message', onMessage);
}
