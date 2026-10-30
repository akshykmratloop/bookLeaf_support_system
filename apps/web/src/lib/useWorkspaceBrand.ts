import type { AssistantAvailability } from '@bookleaf/shared';
import { useEffect } from 'react';
import { useAssistantAvailability } from './assistant';
import { brandCss, readableBrand } from './brand';
import { isFramed, tellHost } from './frame';
import { showTheme, type Theme } from './theme';

const STYLE_ID = 'workspace-brand';
const DEFAULT_NAME = 'BookLeaf';
/** BookLeaf's coral: its hand-tuned shades in tokens.css stay as they are. */
const DEFAULT_COLOR = '#d13f53';

type Brand = AssistantAvailability['brand'];
const THEMES: Record<Brand['theme'], Theme | null> = { AUTO: null, LIGHT: 'light', DARK: 'dark' };

/** Puts the workspace's colour shades on the page (none for BookLeaf's own coral). */
function paintBrand(color: string): (() => void) | undefined {
  const css = color.toLowerCase() === DEFAULT_COLOR ? null : brandCss(color);
  if (!css) return undefined;
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.append(el);
  }
  el.textContent = css;
  return () => el?.remove();
}

/** What the framing page (embed.js) needs to match: colour, name, launcher, logo and theme. */
function tellHostBrand(brand: Brand): void {
  tellHost('brand', {
    color: readableBrand(brand.color) ?? brand.color,
    name: brand.name,
    launcherText: brand.launcherText,
    logoUrl: brand.logoUrl,
    theme: THEMES[brand.theme],
  });
}

/** Paints the app in the workspace's colour and tells the framing page, so both match. */
export function useWorkspaceBrand(): string {
  const brand = useAssistantAvailability().data?.brand;
  const theme = brand ? THEMES[brand.theme] : null;
  useEffect(() => {
    // Inside the widget the host page passes the final theme back; on a full page, apply it here.
    if (theme && !isFramed()) showTheme(theme);
  }, [theme]);
  useEffect(() => {
    if (!brand) return undefined;
    tellHostBrand(brand);
    return paintBrand(brand.color);
  }, [brand]);
  return brand?.name ?? DEFAULT_NAME;
}
