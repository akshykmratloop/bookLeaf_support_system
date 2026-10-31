import { randomUUID } from 'node:crypto';
import type { WorkspaceRole } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import { call, createHarness, EMAILS, type Harness } from './helpers/app.js';

/**
 * Credentials and integrations (API keys, webhooks, the product connector and its data sources)
 * are changed by the workspace owner only; other staff (ADMIN, AGENT members) may still read
 * them. The role is `workspace_members.role`, read on every such request.
 */
let h: Harness;
const userIds: string[] = [];
const ID = randomUUID();

/** A staff member of BookLeaf's workspace with the given member role, signed in directly. */
async function memberCookie(role: WorkspaceRole): Promise<string> {
  const email = `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@bookleaf.demo`;
  const user = await h.db.user.create({
    data: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      email,
      loginEmail: email,
      name: role,
      role: 'ADMIN',
    },
  });
  userIds.push(user.id);
  await h.db.workspaceMember.create({
    data: { workspaceId: DEFAULT_WORKSPACE_ID, userId: user.id, role },
  });
  const token = await h.container.sessions.sign({
    userId: user.id,
    workspaceId: DEFAULT_WORKSPACE_ID,
    role: 'ADMIN',
    authorId: null,
    name: user.name,
    email,
  });
  return `bl_session=${token}`;
}

const OWNER_ONLY = [
  ['POST', '/workspace/api-keys'],
  ['DELETE', `/workspace/api-keys/${ID}`],
  ['POST', '/workspace/webhooks'],
  ['PATCH', `/workspace/webhooks/${ID}`],
  ['POST', `/workspace/webhooks/${ID}/rotate-secret`],
  ['DELETE', `/workspace/webhooks/${ID}`],
  ['PUT', '/workspace/connector'],
  ['POST', '/workspace/connector/test'],
  ['PUT', '/workspace/connector/mapping'],
] as const;

const READS = ['/workspace/api-keys', '/workspace/webhooks', '/workspace/connector'] as const;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.db.workspaceMember.deleteMany({ where: { userId: { in: userIds } } });
  await h.db.user.deleteMany({ where: { id: { in: userIds } } });
  await h.close();
});

describe.each<WorkspaceRole>(['ADMIN', 'AGENT'])('a workspace %s', (role) => {
  it.each(OWNER_ONLY)('is refused %s %s (403)', async (method, url) => {
    const res = await call(h, method, url, await memberCookie(role), {});
    expect(res.statusCode).toBe(403);
    expect(res.json<{ title: string }>().title).toMatch(/owner/);
  });

  it('may still read keys, webhooks and the connector', async () => {
    const cookie = await memberCookie(role);
    for (const url of READS) expect((await call(h, 'GET', url, cookie)).statusCode).toBe(200);
  });
});

describe('the workspace owner', () => {
  it('creates and revokes an API key', async () => {
    const owner = await h.login(EMAILS.admin);
    const body = { name: 'Owner key', scopes: ['tickets:read'] };
    const created = await call(h, 'POST', '/workspace/api-keys', owner, body);
    expect(created.statusCode).toBe(201);
    const { key } = created.json<{ key: { id: string } }>();
    expect((await call(h, 'DELETE', `/workspace/api-keys/${key.id}`, owner)).statusCode).toBe(200);
  });

  it('gets past the role check on every owner-only route', async () => {
    const owner = await h.login(EMAILS.admin);
    for (const [method, url] of OWNER_ONLY) {
      const res = await call(h, method, url, owner, {});
      expect(res.statusCode, `${method} ${url}`).not.toBe(403);
    }
  });
});
