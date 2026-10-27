import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AssistantSettings, ChatReply, ChatSession } from '@bookleaf/shared';
import { defaultHandler } from './helpers/app.js';
import { call, createHarness, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let priya: string;
let rohit: string;
let arjun: string;
let admin: string;

async function setAssistant(patch: Partial<Omit<AssistantSettings, 'version' | 'updatedAt'>>) {
  const { settings } = (await call(h, 'GET', '/admin/assistant', admin)).json<{
    settings: AssistantSettings;
  }>();
  const res = await call(h, 'PUT', '/admin/assistant/settings', admin, {
    version: settings.version,
    ...patch,
  });
  expect(res.statusCode).toBe(200);
}

async function startChat(cookie: string): Promise<ChatSession> {
  const res = await call(h, 'POST', '/chat/sessions', cookie);
  expect(res.statusCode).toBe(201);
  return res.json<ChatSession>();
}

const send = (cookie: string, id: string, body: string) =>
  call(h, 'POST', `/chat/sessions/${id}/messages`, cookie, { body });

beforeAll(async () => {
  h = await createHarness();
  [priya, rohit, arjun, admin] = await Promise.all([
    h.login(EMAILS.priya),
    h.login(EMAILS.rohit),
    h.login(EMAILS.arjun),
    h.login(EMAILS.admin),
  ]);
});
afterAll(() => h.close());

describe('admin control', () => {
  it('chat and voice are off by default and every chat endpoint refuses (403)', async () => {
    const av = (await call(h, 'GET', '/assistant/availability', priya)).json<{
      chat: { state: string };
      voice: { state: string };
    }>();
    expect(av.chat.state).toBe('DISABLED');
    expect(av.voice.state).toBe('DISABLED');
    const res = await call(h, 'POST', '/chat/sessions', priya);
    expect(res.statusCode).toBe(403);
    expect(res.json<{ code: string }>().code).toBe('FEATURE_DISABLED');
  });

  it('only admins can change the switches; stale versions conflict; changes are audited', async () => {
    const asAuthor = await call(h, 'PUT', '/admin/assistant/settings', priya, {
      version: 0,
      chatEnabled: true,
    });
    expect(asAuthor.statusCode).toBe(403);
    await setAssistant({ chatEnabled: true });
    const stale = await call(h, 'PUT', '/admin/assistant/settings', admin, {
      version: 0,
      chatEnabled: false,
    });
    expect(stale.statusCode).toBe(409);
    const audit = await h.db.auditEvent.count({ where: { action: 'assistant_settings.updated' } });
    expect(audit).toBeGreaterThan(0);
    const av = (await call(h, 'GET', '/assistant/availability', priya)).json<{
      chat: { state: string };
    }>();
    expect(av.chat.state).toBe('AVAILABLE');
  });

  it('rejects a chat model outside the allowlist (422)', async () => {
    const { settings } = (await call(h, 'GET', '/admin/assistant', admin)).json<{
      settings: AssistantSettings;
    }>();
    const res = await call(h, 'PUT', '/admin/assistant/settings', admin, {
      version: settings.version,
      chatModel: 'gpt-made-up',
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('grounded answers', () => {
  it('answers from the author records, shows the facts used and logs the AI run', async () => {
    const chat = await startChat(priya);
    const fact = await h.db.book.findUniqueOrThrow({ where: { externalId: 'BK001' } });
    const pending = `₹${(fact.royaltyPendingPaise / 100).toLocaleString('en-IN')}`;
    h.setAi((req) =>
      req.task === 'CHAT'
        ? {
            answer: `${fact.title} has ${pending} pending.`,
            claims: [{ quote: pending, factIds: ['book.BK001.royalty_pending'] }],
            ticketSuggestion: null,
          }
        : defaultHandler(req),
    );
    const res = await send(priya, chat.id, 'How much is pending on my first book?');
    expect(res.statusCode).toBe(200);
    const { reply, session } = res.json<ChatReply>();
    expect(reply.source).toBe('AI');
    expect(reply.body).toContain(pending);
    expect(reply.factsUsed[0]?.display).toContain(pending);
    expect(session.turnCount).toBe(1);
    expect(await h.db.aiRun.count({ where: { task: 'CHAT' } })).toBeGreaterThan(0);
  });

  it('never shows an invented figure: two failed checks become a safe answer', async () => {
    const chat = await startChat(priya);
    h.setAi((req) =>
      req.task === 'CHAT'
        ? { answer: 'You will get ₹77,777 tomorrow.', claims: [], ticketSuggestion: null }
        : defaultHandler(req),
    );
    const { reply } = (await send(priya, chat.id, 'When do I get paid?')).json<ChatReply>();
    expect(reply.source).toBe('SAFE_FALLBACK');
    expect(reply.body).not.toContain('77,777');
  });

  it('degrades to an "unavailable" answer with a ticket offer when the AI is down', async () => {
    const chat = await startChat(priya);
    const ai = await h.db.aiSettings.findUniqueOrThrow({ where: { id: 1 } });
    await call(h, 'PUT', '/admin/ai/settings', admin, {
      version: ai.version,
      simulateOutage: true,
    });
    const res = await send(priya, chat.id, 'Is my book available on Flipkart yet?');
    expect(res.statusCode).toBe(200);
    expect(res.json<ChatReply>().reply.source).toBe('UNAVAILABLE');
    expect(res.json<ChatReply>().reply.proposal).not.toBeNull();
    const after = await h.db.aiSettings.findUniqueOrThrow({ where: { id: 1 } });
    await call(h, 'PUT', '/admin/ai/settings', admin, {
      version: after.version,
      simulateOutage: false,
    });
    h.container.ai.invalidate();
  });
});

describe('isolation and validation', () => {
  it("another author's conversation is not found (404) and admins cannot chat (403)", async () => {
    const chat = await startChat(priya);
    expect((await call(h, 'GET', `/chat/sessions/${chat.id}`, rohit)).statusCode).toBe(404);
    expect((await send(rohit, chat.id, 'hello')).statusCode).toBe(404);
    expect((await call(h, 'POST', '/chat/sessions', admin)).statusCode).toBe(403);
    expect((await call(h, 'GET', `/admin/chat/sessions/${chat.id}`, priya)).statusCode).toBe(403);
    expect((await call(h, 'GET', `/admin/chat/sessions/${chat.id}`, admin)).statusCode).toBe(200);
  });

  it('enforces the message length limits (1–1000 characters after cleaning)', async () => {
    const chat = await startChat(priya);
    expect((await send(priya, chat.id, '   ')).statusCode).toBe(422);
    expect((await send(priya, chat.id, 'x'.repeat(1001))).statusCode).toBe(422);
    expect((await send(priya, chat.id, 'x'.repeat(1000))).statusCode).toBe(200);
  });

  it('stops a conversation at the turn limit (409) and at the daily limit (429)', async () => {
    const full = await startChat(rohit);
    await h.db.chatSession.update({ where: { id: full.id }, data: { turnCount: 30 } });
    const turn = await send(rohit, full.id, 'one more question');
    expect(turn.statusCode).toBe(409);
    expect(turn.json<{ code: string }>().code).toBe('CHAT_TURN_LIMIT');
    const chat = await startChat(rohit);
    await h.db.chatMessage.createMany({
      data: Array.from({ length: 100 }, () => ({
        sessionId: chat.id,
        role: 'AUTHOR' as const,
        body: 'q',
      })),
    });
    const daily = await send(rohit, chat.id, 'hello again');
    expect(daily.statusCode).toBe(429);
    expect(daily.json<{ code: string }>().code).toBe('CHAT_DAILY_LIMIT');
  });

  it('rate-limits each author to 20 messages per minute', async () => {
    const chat = await startChat(arjun);
    const codes: number[] = [];
    for (let i = 0; i < 21; i += 1)
      codes.push((await send(arjun, chat.id, `question ${i}`)).statusCode);
    expect(codes.slice(0, 20).every((c) => c === 200)).toBe(true);
    expect(codes[20]).toBe(429);
  });
});

describe('ticket from chat', () => {
  it('creates one CHAT ticket per conversation, linked for admins and queued for triage', async () => {
    const chat = await startChat(priya);
    await send(priya, chat.id, 'My royalty statement looks wrong for last quarter');
    const body = {
      bookId: null,
      subject: 'Royalty statement looks wrong',
      description: 'My royalty statement for last quarter looks wrong. Please check it.',
    };
    const first = await call(h, 'POST', `/chat/sessions/${chat.id}/ticket`, priya, body);
    expect(first.statusCode).toBe(201);
    const ticket = first.json<{ id: string }>();
    const again = await call(h, 'POST', `/chat/sessions/${chat.id}/ticket`, priya, body);
    expect(again.statusCode).toBe(200);
    expect(again.json<{ id: string }>().id).toBe(ticket.id);
    const asAdmin = (await call(h, 'GET', `/tickets/${ticket.id}`, admin)).json<{
      source: string;
      chatSessionId: string;
    }>();
    expect(asAdmin).toMatchObject({ source: 'CHAT', chatSessionId: chat.id });
    expect(await h.db.aiJob.count({ where: { ticketId: ticket.id, kind: 'TRIAGE' } })).toBe(1);
  });

  it('switching chat off blocks authors at once; admins still read the transcript', async () => {
    const chat = await startChat(priya);
    await setAssistant({ chatEnabled: false });
    expect((await send(priya, chat.id, 'still there?')).statusCode).toBe(403);
    expect((await call(h, 'GET', '/chat/sessions/current', priya)).statusCode).toBe(403);
    expect((await call(h, 'GET', `/admin/chat/sessions/${chat.id}`, admin)).statusCode).toBe(200);
  });
});
