export type Theme = 'dark' | 'light';
// v2: the bright redesign made light the default; an older saved choice of dark is not carried over.
const KEY = 'bookleaf.theme.v2';

export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this page view.
  }
}

/** Shows a theme without saving it (the widget wears the host page's choice, not its own). */
export function showTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
