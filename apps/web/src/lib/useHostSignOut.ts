import { useEffect } from 'react';
import { api } from './api';
import { onHostCommand, tellHost } from './frame';

/** Ends the support session, then lets the host page carry on (it waits for `signedout`). */
export async function signOutForHost(onSignedOut: () => void): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    onSignedOut();
    tellHost('signedout');
  }
}

/**
 * When the author signs out of the host product, the host page asks the widget to sign out too
 * (window.BookLeafSupport.signOut() in embed.js), so the next person at this browser does not
 * find the author's support session still open.
 */
export function useHostSignOut(onSignedOut: () => void): void {
  useEffect(() => onHostCommand('signout', () => void signOutForHost(onSignedOut)), [onSignedOut]);
}
