import { useSyncExternalStore } from 'react';

/** True while the CSS media query matches (for example, the widget is wide). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's lg breakpoint: room for a side column. */
export const WIDE = '(min-width: 1024px)';
