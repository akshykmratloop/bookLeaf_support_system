/**
 * The published demo login from the README, so a tester can open the support desk in one
 * click. It is not a secret: every demo account shares this one documented password.
 */
export const DEMO_PASSWORD = 'TestBookLeaf@123';

export interface DemoStaffAccount {
  readonly name: string;
  readonly email: string;
}

/** BookLeaf's support admin. Authors never sign in on this page, so they are not listed. */
export const DEMO_ADMIN: DemoStaffAccount = {
  name: 'Neha Verma (Ops)',
  email: 'admin@bookleaf.com',
};

/** What the sign-in form exposes so a demo pick can fill it and submit it. */
export interface FillableSignIn {
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  submit: (email: string, password: string) => unknown;
}

/** Fills the visible fields, then submits through the form's own sign-in path. */
export function fillAndSubmit(
  account: Pick<DemoStaffAccount, 'email'>,
  form: FillableSignIn,
): unknown {
  form.setEmail(account.email);
  form.setPassword(DEMO_PASSWORD);
  return form.submit(account.email, DEMO_PASSWORD);
}
