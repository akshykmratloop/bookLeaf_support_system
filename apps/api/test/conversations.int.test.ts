import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConversationDetail, ConversationPage } from '@bookleaf/shared';
import { call, createHarness, EMAILS, type Harness } from './helpers/app.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';

let h: Harness;
let rohit: string;
let kavita: string;
let admin: string;
let authorId: string;

// Rows are dated in the future so they sort above anything other test files created.
const T = Date.parse('2031-01-01T10:00:00.000Z');
const at = (minutes: number) => new Date(T + minutes * 60_000);
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (role: 'AUTHOR' | 'ASSISTANT', text: string, m: number) => ({
  role,
  text,
  at: at(m).toISOString(),
});

async function addChat(id: string, minutes: number, firstWords: string, turns = 1) {
  await h.db.chatSession.create({
    data: {
      id,
      workspaceId: DEFAULT_WORKSPACE_ID,
      authorId,
      turnCount: turns,
      createdAt: at(minutes),
    },
  });
  if (turns === 0) return;
  await h.db.chatMessage.createMany({
    data: [
      { sessionId: id, role: 'AUTHOR', body: firstWords, createdAt: at(minutes) },
      {
        sessionId: id,
        role: 'ASSISTANT',
        body: 'Here is what I found.',
        createdAt: at(minutes + 1),
      },
    ],
  });
}

async function addCall(
  id: string,
  minutes: number,
  /** A first call is its own thread (as the voice module saves it); null is the older form. */
  opts: { threadId?: string | null; started?: boolean },
) {
  await h.db.voiceSession.create({
    data: {
      id,
      workspaceId: DEFAULT_WORKSPACE_ID,
      authorId,
      provider: 'fake',
      model: 'fake',
      maxSeconds: 300,
      status: 'ENDED',
      threadId: opts.threadId === undefined ? id : opts.threadId,
      startedAt: opts.started === false ? null : at(minutes),
      createdAt: at(minutes),
      transcript: [
        line('AUTHOR', `call words ${minutes}`, minutes),
        line('ASSISTANT', 'ok', minutes),
      ],
    },
  });
}

async function allPages(cookie: string, limit: number): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const q: string = cursor ? `&cursor=${cursor}` : '';
    const res = await call(h, 'GET', `/conversations?limit=${limit}${q}`, cookie);
    expect(res.statusCode).toBe(200);
    const page = res.json<ConversationPage>();
    ids.push(...page.items.map((i) => i.id));
    cursor = page.nextCursor;
  } while (cursor);
  return ids;
}

beforeAll(async () => {
  h = await createHarness();
  [rohit, kavita, admin] = await Promise.all([
    h.login(EMAILS.rohit),
    h.login(EMAILS.kavita),
    h.login(EMAILS.admin),
  ]);
  const author = await h.db.author.findFirstOrThrow({ where: { user: { email: EMAILS.rohit } } });
  authorId = author.id;
  await addChat(ID(1), 30, 'My royalty statement looks low');
  await addCall(ID(2), 20, {});
  await addCall(ID(3), 25, { threadId: ID(2) }); // the same call, continued
  await addChat(ID(4), 10, 'Where is my book?');
  await h.db.ticketDraft.create({
    data: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      authorId,
      chatSessionId: ID(4),
      subject: 'Book not on Amazon',
    },
  });
  await addChat(ID(5), 0, 'tie with a call');
  await addCall(ID(6), 0, { threadId: null }); // older form; same time as chat 5: larger id first
  await addChat(ID(7), 40, 'never written in', 0); // left out: no messages
  await addCall(ID(8), 50, { started: false }); // left out: never connected
});
afterAll(async () => {
  // Leave no future-dated rows behind: other files count this author's recent calls.
  const ids = Array.from({ length: 8 }, (_, i) => ID(i + 1));
  await h.db.ticketDraft.deleteMany({ where: { chatSessionId: { in: ids } } });
  await h.db.chatMessage.deleteMany({ where: { sessionId: { in: ids } } });
  await h.db.chatSession.deleteMany({ where: { id: { in: ids } } });
  await h.db.voiceSession.deleteMany({ where: { id: { in: ids } } });
  await h.close();
});

describe('GET /conversations', () => {
  it('lists chats and calls together, newest first, one row per call thread', async () => {
    const res = await call(h, 'GET', '/conversations?limit=5', rohit);
    const page = res.json<ConversationPage>();
    expect(page.items.map((i) => [i.kind, i.id])).toEqual([
      ['CHAT', ID(1)],
      ['CALL', ID(2)],
      ['CHAT', ID(4)],
      ['CALL', ID(6)],
      ['CHAT', ID(5)],
    ]);
    const [chat, thread, drafted] = page.items;
    expect(chat).toMatchObject({ title: 'My royalty statement looks low', messageCount: 2 });
    expect(thread).toMatchObject({ title: 'call words 20', messageCount: 4, ticket: null });
    expect(drafted).toMatchObject({ title: 'Book not on Amazon', draftStatus: 'OPEN' });
  });

  it('pages with no gaps or repeats, including rows created at the same moment', async () => {
    const mine = [ID(1), ID(2), ID(4), ID(6), ID(5)];
    for (const limit of [1, 2, 3]) {
      const ids = await allPages(rohit, limit);
      expect(ids.slice(0, 5)).toEqual(mine);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("never shows another author's conversations", async () => {
    const ids = await allPages(kavita, 50);
    expect(ids).not.toContain(ID(1));
    expect(ids).not.toContain(ID(2));
  });

  it('is for signed-in authors only', async () => {
    expect((await call(h, 'GET', '/conversations')).statusCode).toBe(401);
    expect((await call(h, 'GET', '/conversations', admin)).statusCode).toBe(403);
  });

  it('rejects a bad cursor or limit', async () => {
    expect((await call(h, 'GET', '/conversations?cursor=zzz', rohit)).statusCode).toBe(422);
    expect((await call(h, 'GET', '/conversations?limit=51', rohit)).statusCode).toBe(422);
    expect((await call(h, 'GET', '/conversations?limit=0', rohit)).statusCode).toBe(422);
  });
});

describe('opening a past conversation', () => {
  it('shows a chat with every message and its draft', async () => {
    const res = await call(h, 'GET', `/conversations/chats/${ID(4)}`, rohit);
    expect(res.statusCode).toBe(200);
    const chat = res.json<ConversationDetail>();
    expect(chat.lines.map((l) => l.role)).toEqual(['AUTHOR', 'ASSISTANT']);
    expect(chat.draft?.subject).toBe('Book not on Amazon');
  });

  it('shows a continued call as one conversation, in spoken order', async () => {
    const res = await call(h, 'GET', `/conversations/calls/${ID(2)}`, rohit);
    const thread = res.json<ConversationDetail>();
    expect(thread.lines.filter((l) => l.role === 'AUTHOR').map((l) => l.text)).toEqual([
      'call words 20',
      'call words 25',
    ]);
  });

  it("returns 404 for another author's conversation or a continued call's own id", async () => {
    expect((await call(h, 'GET', `/conversations/chats/${ID(1)}`, kavita)).statusCode).toBe(404);
    expect((await call(h, 'GET', `/conversations/calls/${ID(2)}`, kavita)).statusCode).toBe(404);
    expect((await call(h, 'GET', `/conversations/calls/${ID(3)}`, rohit)).statusCode).toBe(404);
  });
});
