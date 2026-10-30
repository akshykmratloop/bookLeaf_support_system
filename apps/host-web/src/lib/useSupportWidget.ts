import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getConfig } from './api';

const TAG_ID = 'bookleaf-support-widget';

/**
 * Adds the support widget (one script tag) once the author is signed in. The support module's
 * address and BookLeaf's workspace there come from BookLeaf's server, so they are configured in
 * one place. The widget opens `/embed/<workspace>`, which only BookLeaf's pages may frame.
 */
export function useSupportWidget(): void {
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: Infinity });
  const supportUrl = config.data?.supportUrl;
  const workspace = config.data?.supportWorkspace;
  useEffect(() => {
    if (!supportUrl || document.getElementById(TAG_ID)) return;
    const tag = document.createElement('script');
    tag.id = TAG_ID;
    tag.src = `${supportUrl}/embed.js`;
    tag.defer = true;
    if (workspace) tag.dataset.workspace = workspace;
    tag.dataset.tokenUrl = '/support-token';
    tag.dataset.label = 'Help';
    document.body.append(tag);
  }, [supportUrl, workspace]);
}

/** Opens the widget from our own buttons ("Get help", the overdue alert). */
export function openHelp(expand = false): void {
  const widget = (window as Window & { BookLeafSupport?: { open: () => void; expand: () => void } })
    .BookLeafSupport;
  if (expand) widget?.expand();
  else widget?.open();
}
