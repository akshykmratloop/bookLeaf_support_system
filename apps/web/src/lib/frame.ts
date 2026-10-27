/**
 * Talking to the host page that framed the support app (public/embed.js). Messages carry no
 * secrets; embed.js accepts them only from this origin and from this frame's window.
 */
const PREFIX = 'bookleaf-support:';

export const isFramed = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // a cross-origin parent throws on access: we are framed
  }
};

type HostMessage = 'reauth' | 'escape' | 'expand' | 'close' | 'brand';

export function tellHost(type: HostMessage, extra: Record<string, string> = {}): void {
  if (!isFramed()) return;
  // '*': the host's origin is not known here; the message is only a hint and embed.js checks it.
  window.parent.postMessage({ type: `${PREFIX}${type}`, ...extra }, '*');
}

/** The session ran out: ask the host page for a fresh sign-in on the same screen. */
export const requestReauth = (path: string) => tellHost('reauth', { path });
