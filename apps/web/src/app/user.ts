import type { AuthUser } from '@bookleaf/shared';
import { useOutletContext } from 'react-router';

/** Where a user lands after signing in. */
export const homeFor = (user: AuthUser) => (user.role === 'ADMIN' ? '/admin' : '/embed');

/** The signed-in user, available to every page under the authed layout. */
export const useUser = () => useOutletContext<AuthUser>();
