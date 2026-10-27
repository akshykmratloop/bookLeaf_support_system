import type { AuthUser } from '@bookleaf/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from './api';
import { keys } from './queries';

/** Signs in with email and password; the caller decides where to go next. */
export function useLogin(onSignedIn: (user: AuthUser) => void) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const login = async (email: string, password: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await api<{ user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      qc.setQueryData(keys.me, user);
      onSignedIn(user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };
  return { login, error, isSubmitting };
}
