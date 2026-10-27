import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getConfig } from './api';

const TAG_ID = 'bookleaf-support-widget';

/**
 * Adds the support widget (one script tag) once the author is signed in. The support module's
 * address comes from BookLeaf's server, so it is configured in one place.
 */
export function useSupportWidget(): void {
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: Infinity });
  const supportUrl = config.data?.supportUrl;
  useEffect(() => {
    if (!supportUrl || document.getElementById(TAG_ID)) return;
    const tag = document.createElement('script');
    tag.id = TAG_ID;
    tag.src = `${supportUrl}/embed.js`;
    tag.defer = true;
    tag.dataset.tokenUrl = '/support-token';
    tag.dataset.label = 'Help';
    document.body.append(tag);
  }, [supportUrl]);
}

/** Opens the widget from our own buttons ("Get help", the overdue alert). */
export function openHelp(expand = false): void {
  const widget = (window as Window & { BookLeafSupport?: { open: () => void; expand: () => void } })
    .BookLeafSupport;
  if (expand) widget?.expand();
  else widget?.open();
}
