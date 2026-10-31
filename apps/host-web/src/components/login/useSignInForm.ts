import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { signIn } from '../../lib/api';
import { fillAndSubmit, type DemoAuthor } from '../../lib/demoAccounts';
import { DASHBOARD_KEY } from '../../lib/keys';

function useSignIn() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      await qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, submit };
}

export interface SignInForm {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  error: string | null;
  busy: boolean;
  /** The demo author being signed in, or null for the manual form. */
  demoEmail: string | null;
  submitTyped: () => void;
  signInAs: (account: DemoAuthor) => void;
}

/**
 * The sign-in form's state, shared by the manual card and the one-click demo authors: both
 * submit through the same `submit`, so they share its loading and error states.
 */
export function useSignInForm(): SignInForm {
  const [email, setEmail] = useState('priya.sharma@email.com');
  const [password, setPassword] = useState('');
  const [demoEmail, setDemoEmail] = useState<string | null>(null);
  const { error, busy, submit } = useSignIn();
  const submitTyped = () => {
    setDemoEmail(null);
    void submit(email, password);
  };
  const signInAs = (account: DemoAuthor) => {
    setDemoEmail(account.email);
    void fillAndSubmit(account, { setEmail, setPassword, submit });
  };
  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    busy,
    demoEmail,
    submitTyped,
    signInAs,
  };
}
