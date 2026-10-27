import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canSee } from '../src/modules/events/routes.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import { call, createHarness, deleteWorkspace, EMAILS, type Harness } from './helpers/app.js';

/**
 * Regression tests for the audit's cross-workspace findings (docs/qa/fable-review.md F-01..F-04,
 * F-17): an admin of a self-serve workspace must never reach BookLeaf's data or platform switches.
 */
let h: Harness;
let acme: string;
let bookleaf: string;
let chatId: string;
let callId: string;

const OWNER = {
  workspaceName: 'Acme Isolation',
  slug: 'acme-isolation',
  ownerName: 'Ada Owner',
  email: 'ada@acme-isolation.example',
  password: 'Correct-Horse-42',
};

beforeAll(async () => {
  h = await createHarness();
  await call(h, 'POST', '/signup', undefined, OWNER);
  [acme, bookleaf] = await Promise.all([
    h.login(OWNER.email, OWNER.password),
    h.login(EMAILS.admin),
  ]);
  await h.login(EMAILS.priya); // authors are created when they first arrive from the host
  const author = await h.db.author.findFirstOrThrow({
    where: { workspaceId: DEFAULT_WORKSPACE_ID },
  });
  const chat = await h.db.chatSession.create({
    data: { workspaceId: DEFAULT_WORKSPACE_ID, authorId: author.id },
  });
  await h.db.chatMessage.create({
    data: { sessionId: chat.id, role: 'AUTHOR', body: 'My bank account ends 4321' },
  });
  chatId = chat.id;
  const now = h.clock.now();
  const voice = await h.db.voiceSession.create({
    data: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      authorId: author.id,
      status: 'ENDED',
      provider: 'fake',
      model: 'fake',
      maxSeconds: 300,
      createdAt: now,
    },
  });
  callId = voice.id;
});
afterAll(async () => {
  await h.db.chatSession.deleteMany({ where: { id: chatId } });
  await h.db.voiceSession.deleteMany({ where: { id: callId } });
  await deleteWorkspace(h.db, OWNER.slug);
  await h.close();
});

describe("another workspace's admin", () => {
  it("cannot read BookLeaf's chat transcript (404), while BookLeaf's admin can (F-01)", async () => {
    expect((await call(h, 'GET', `/admin/chat/sessions/${chatId}`, acme)).statusCode).toBe(404);
    expect((await call(h, 'GET', `/admin/chat/sessions/${chatId}`, bookleaf)).statusCode).toBe(200);
  });

  it("cannot read BookLeaf's voice call (404), while BookLeaf's admin can (F-02)", async () => {
    expect((await call(h, 'GET', `/admin/voice/calls/${callId}`, acme)).statusCode).toBe(404);
    expect((await call(h, 'GET', `/admin/voice/calls/${callId}`, bookleaf)).statusCode).toBe(200);
  });

  it('cannot see or change the platform AI settings, or use the platform key (403) (F-03, F-17)', async () => {
    const { version } = (await call(h, 'GET', '/admin/ai/settings', bookleaf)).json<{
      version: number;
    }>();
    const attempts = await Promise.all([
      call(h, 'GET', '/admin/ai/status', acme),
      call(h, 'GET', '/admin/ai/settings', acme),
      call(h, 'PUT', '/admin/ai/settings', acme, { version, simulateOutage: true }),
      call(h, 'POST', '/admin/ai/test', acme),
    ]);
    expect(attempts.map((r) => r.statusCode)).toEqual([403, 403, 403, 403]);
    const after = (await call(h, 'GET', '/admin/ai/settings', bookleaf)).json<{
      simulateOutage: boolean;
      version: number;
    }>();
    expect(after).toMatchObject({ version, simulateOutage: false });
  });

  it("never receives BookLeaf's ticket events on its live stream (F-04)", () => {
    const event = {
      type: 'ticket.created' as const,
      ticketId: 't1',
      authorId: 'a1',
      authorVisible: true,
      workspaceId: DEFAULT_WORKSPACE_ID,
    };
    const admin = (workspaceId: string) =>
      ({ role: 'ADMIN', workspaceId, authorId: null, userId: 'u' }) as never;
    expect(canSee(admin(DEFAULT_WORKSPACE_ID), event)).toBe(true);
    expect(canSee(admin('00000000-0000-4000-8000-0000000000ac'), event)).toBe(false);
  });
});
