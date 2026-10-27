import type { FastifyRequest } from 'fastify';
import { findById, type AuthorAccount } from './data/authors.js';
import { readHostSession } from './tokens.js';

/** The demo product's own session cookie (httpOnly, SameSite=Strict). */
export const SESSION_COOKIE = 'hd_session';

/** The signed-in author, or null. */
export async function signedInAccount(
  req: FastifyRequest,
  authors: AuthorAccount[],
  signingSecret: string,
): Promise<AuthorAccount | null> {
  const token = req.cookies[SESSION_COOKIE];
  const id = token ? await readHostSession(token, signingSecret) : null;
  return id ? findById(authors, id) : null;
}
