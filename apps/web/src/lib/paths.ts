import { DEFAULT_WORKSPACE_SLUG, type ConversationKind } from '@bookleaf/shared';
import { useMemo } from 'react';
import { useParams } from 'react-router';

/** A workspace's author app: `/embed/<slug>` (in the widget, or full page from the host). */
export const authorHome = (slug: string) => `/embed/${slug}`;

/** Every page of one workspace's author app. */
export function authorPathsFor(slug: string) {
  const home = authorHome(slug);
  return {
    home,
    ask: `${home}/ask`,
    tickets: `${home}/tickets`,
    newTicket: `${home}/tickets/new`,
    ticket: (id: string) => `${home}/tickets/${id}`,
    history: `${home}/history`,
    conversation: (kind: ConversationKind, id: string) =>
      `${home}/history/${kind === 'CHAT' ? 'chat' : 'call'}/${id}`,
  };
}
export type AuthorPaths = ReturnType<typeof authorPathsFor>;

/** The author app's pages for the workspace in the address (`/embed/:workspace/…`). */
export function useAuthorPaths(): AuthorPaths {
  const slug = useParams().workspace ?? DEFAULT_WORKSPACE_SLUG;
  return useMemo(() => authorPathsFor(slug), [slug]);
}

/**
 * An address of the old shared widget (`/embed`, `/embed/tickets/7`, before F-18) as the same
 * page of the default workspace's app (BookLeaf), so old links and host pages keep working.
 */
export const legacyAuthorPath = (path: string) =>
  path.replace(/^\/embed(?=\/|$)/, authorHome(DEFAULT_WORKSPACE_SLUG));
