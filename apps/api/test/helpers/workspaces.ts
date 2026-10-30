import { call, type Harness } from './app.js';

/** A self-serve signup body for a test workspace. */
export const ownerOf = (slug: string, workspaceName: string) => ({
  workspaceName,
  slug,
  ownerName: 'Test Owner',
  email: `owner@${slug}.example`,
  password: 'Correct-Horse-42',
});

export async function signupWorkspace(h: Harness, body: ReturnType<typeof ownerOf>) {
  const res = await call(h, 'POST', '/signup', undefined, body);
  if (res.statusCode !== 201) throw new Error(`signup ${body.slug}: ${res.statusCode}`);
}

/** The workspace owner's cookie, issued directly (stays under the login rate limit). */
export async function ownerCookie(h: Harness, slug: string): Promise<string> {
  const user = await h.db.user.findFirstOrThrow({ where: { loginEmail: `owner@${slug}.example` } });
  const token = await h.container.sessions.sign({
    userId: user.id,
    workspaceId: user.workspaceId,
    role: 'ADMIN',
    authorId: null,
    name: user.name,
    email: user.email,
  });
  return `bl_session=${token}`;
}

/** An author of the workspace, signed in the way the host hand-over signs them in. */
export async function authorCookieOf(h: Harness, slug: string): Promise<string> {
  const ws = await h.db.workspace.findUniqueOrThrow({ where: { slug } });
  const user = await h.db.user.create({
    data: { workspaceId: ws.id, email: `author@${slug}.example`, name: 'Sam Lee', role: 'AUTHOR' },
  });
  const author = await h.db.author.create({
    data: { workspaceId: ws.id, userId: user.id, externalId: `AUTH-${slug}` },
  });
  const token = await h.container.sessions.sign({
    userId: user.id,
    workspaceId: ws.id,
    role: 'AUTHOR',
    authorId: author.id,
    name: user.name,
    email: user.email,
  });
  return `bl_session=${token}`;
}

/**
 * A new signup starts with AI, chat and voice off. This turns them on, as the super admin does
 * when approving a company, for tests about what those features do.
 */
export async function allowPaidFeatures(h: Harness, slug: string): Promise<void> {
  const ws = await h.db.workspace.findUniqueOrThrow({ where: { slug } });
  await h.db.workspacePlan.update({
    where: { workspaceId: ws.id },
    data: { aiEnabled: true, chatAllowed: true, voiceAllowed: true },
  });
  h.container.configs.invalidate(ws.id);
}
