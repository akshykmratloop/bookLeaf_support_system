import { findById, loadAuthors } from '../src/data/authors.js';
import type { HostConfig } from '../src/config.js';
import type { AuthorRecord } from '../src/facts/index.js';

export const AUTHORS = loadAuthors();

export const TEST_CONFIG: HostConfig = {
  HOST_DEMO_PORT: 0,
  SUPPORT_URL: 'http://localhost:5173',
  SUPPORT_WORKSPACE: 'bookleaf',
  HOST_API_KEY: 'test-host-api-key-0123456789',
  HOST_SIGNING_SECRET: 'test-host-signing-secret-0123456789abcdef',
  DATA_AS_OF: '2025-12-31',
  HOST_DEMO_PASSWORD: 'Author@Test1',
  HOST_WEB_DIST: '/nonexistent/host-web-dist',
  HOST_SECURE_COOKIES: false,
};

/** One sample author as the facts engine reads it (book ids are BK001…). */
export function sampleAuthor(externalId: string): AuthorRecord {
  const account = findById(AUTHORS, externalId);
  if (!account) throw new Error(`No sample author ${externalId}`);
  return account.record;
}
