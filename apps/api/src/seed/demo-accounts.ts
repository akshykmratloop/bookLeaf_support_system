/**
 * Admin accounts for the ops team. The brief's dataset has none, so two are seeded. They sign in
 * with SEED_ADMIN_PASSWORD; the live demo publishes `TestBookLeaf@123` (README).
 */
export const DEMO_ADMINS = [
  { email: 'admin@bookleaf.com', name: 'Neha Verma (Ops)' },
  { email: 'ops2@bookleaf.com', name: 'Karan Mehta (Ops)' },
] as const;
