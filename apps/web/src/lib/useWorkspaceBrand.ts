import { useEffect } from 'react';
import { useAssistantAvailability } from './assistant';
import { brandCss, readableBrand } from './brand';
import { tellHost } from './frame';

const STYLE_ID = 'workspace-brand';
const DEFAULT_NAME = 'BookLeaf';
/** BookLeaf's coral: its hand-tuned shades in tokens.css stay as they are. */
const DEFAULT_COLOR = '#d13f53';

/** Paints the app in the workspace's colour and tells the framing page, so both match. */
export function useWorkspaceBrand(): string {
  const brand = useAssistantAvailability().data?.brand;
  const color = brand?.color;
  useEffect(() => {
    if (!color) return;
    tellHost('brand', { color: readableBrand(color) ?? color, name: brand?.name ?? DEFAULT_NAME });
    const css = color.toLowerCase() === DEFAULT_COLOR ? null : brandCss(color);
    if (!css) return;
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.append(el);
    }
    el.textContent = css;
    return () => el?.remove();
  }, [color, brand?.name]);
  return brand?.name ?? DEFAULT_NAME;
}
