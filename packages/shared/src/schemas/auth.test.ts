import { describe, expect, it } from 'vitest';
import { LoginRequestSchema } from './auth.js';

const email = 'admin@bookleaf.demo';

describe('LoginRequestSchema', () => {
  it('asks for the same 12-character floor that signup sets', () => {
    expect(LoginRequestSchema.safeParse({ email, password: 'a'.repeat(11) }).success).toBe(false);
    expect(LoginRequestSchema.safeParse({ email, password: 'a'.repeat(12) }).success).toBe(true);
  });

  it('caps the password at 128 characters', () => {
    expect(LoginRequestSchema.safeParse({ email, password: 'a'.repeat(128) }).success).toBe(true);
    expect(LoginRequestSchema.safeParse({ email, password: 'a'.repeat(129) }).success).toBe(false);
  });

  it('normalises the email', () => {
    const parsed = LoginRequestSchema.parse({
      email: '  Admin@BookLeaf.Demo ',
      password: 'x'.repeat(12),
    });
    expect(parsed.email).toBe(email);
  });
});
