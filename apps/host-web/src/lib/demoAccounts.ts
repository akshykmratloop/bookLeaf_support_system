/**
 * The published demo logins from the README, so a tester can open any author's dashboard in one
 * click. They are not secrets: every demo account shares this one documented password.
 */
export const DEMO_PASSWORD = 'TestBookLeaf@123';

export interface DemoAuthor {
  readonly name: string;
  readonly email: string;
  /** One short, factual line that helps a tester pick an edge case (from sample-data.json). */
  readonly hint: string;
}

/** All ten authors of the sample dataset, in its order (AUTH001 to AUTH010). */
export const DEMO_AUTHORS: readonly DemoAuthor[] = [
  { name: 'Priya Sharma', email: 'priya@bookleaf.com', hint: '2 books · royalty pending' },
  {
    name: 'Rohit Kapoor',
    email: 'rohit@bookleaf.com',
    hint: '2 books · 2,079 copies sold · payouts on time',
  },
  { name: 'Ananya Reddy', email: 'ananya@bookleaf.com', hint: 'Never paid yet · above threshold' },
  { name: 'Vikram Joshi', email: 'vikram@bookleaf.com', hint: '2 books · one fully paid' },
  { name: 'Meera Nair', email: 'meera@bookleaf.com', hint: '2 books' },
  { name: 'Arjun Malhotra', email: 'arjun@bookleaf.com', hint: 'Never paid yet' },
  { name: 'Sneha Kulkarni', email: 'sneha@bookleaf.com', hint: '3 books · one in Cover Design' },
  { name: 'Farhan Sheikh', email: 'farhan@bookleaf.com', hint: 'Fully paid' },
  {
    name: 'Kavita Deshmukh',
    email: 'kavita@bookleaf.com',
    hint: 'Below ₹1,000 threshold · one in Typesetting',
  },
  { name: 'Diya Chatterjee', email: 'diya@bookleaf.com', hint: '2 books · one never paid' },
];

/** What the sign-in form exposes so a demo pick can fill it and submit it. */
export interface FillableSignIn {
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  submit: (email: string, password: string) => unknown;
}

/** Fills the visible fields, then submits through the form's own sign-in path. */
export function fillAndSubmit(account: Pick<DemoAuthor, 'email'>, form: FillableSignIn): unknown {
  form.setEmail(account.email);
  form.setPassword(DEMO_PASSWORD);
  return form.submit(account.email, DEMO_PASSWORD);
}
