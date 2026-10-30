import { DEFAULT_WORKSPACE_SLUG, type AuthUser } from '@bookleaf/shared';
import { useOutletContext } from 'react-router';
import { authorHome } from '../lib/paths';

/** Where a user lands after signing in: staff in the dashboard, authors in their workspace's app. */
export const homeFor = (user: AuthUser, workspaceSlug: string = DEFAULT_WORKSPACE_SLUG) =>
  user.role === 'ADMIN' ? '/admin' : authorHome(workspaceSlug);

/** The signed-in user, available to every page under the authed layout. */
export const useUser = () => useOutletContext<AuthUser>();
