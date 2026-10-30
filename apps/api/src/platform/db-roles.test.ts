import { describe, expect, it } from 'vitest';
import { appRoleFrom } from './db-roles.js';

const ADMIN = 'postgresql://bookleaf:owner-secret@db:5432/bookleaf';

describe('appRoleFrom (S.8)', () => {
  it('reads the app role name, password and schema from DATABASE_URL', () => {
    const role = appRoleFrom(
      'postgresql://bookleaf_app:p%40ss-word-long@db:5432/bookleaf?schema=public',
      ADMIN,
    );
    expect(role).toEqual({ name: 'bookleaf_app', password: 'p@ss-word-long', schema: 'public' });
  });

  it('refuses the owner user as the app role', () => {
    expect(() => appRoleFrom('postgresql://bookleaf:other-password@db/bookleaf', ADMIN)).toThrow(
      /app role, not the owner/,
    );
  });

  it('refuses names that would need quoting in DDL, and short passwords', () => {
    expect(() => appRoleFrom('postgresql://Bad%22Name:long-enough-pw@db/x', ADMIN)).toThrow();
    expect(() => appRoleFrom('postgresql://app:short@db/x', ADMIN)).toThrow(/12 characters/);
    expect(() =>
      appRoleFrom('postgresql://app:long-enough-pw@db/x?schema=x;drop', ADMIN),
    ).toThrow();
  });
});
