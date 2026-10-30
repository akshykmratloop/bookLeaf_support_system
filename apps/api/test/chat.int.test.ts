import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AssistantSettings, ChatReply, ChatSession } from '@bookleaf/shared';
import { defaultHandler, NO_DRAFT } from './helpers/app.js';
import { AUTHOR_CHANGED_TEXT, CONFIRM_FIRST_TEXT } from '../src/modules/chat/draft-turn.js';
import type { StructuredRequest } from '../src/ai/providers/types.js';
import { sampleCustomer } from './fixtures/host.js';
import { call, createHarness, EMAILS, type Harness } from './helpers/app.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';

let h: Harness;
let priya: string;
let rohit: string;
let arjun: string;
let kavita: string;
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
  [priya, rohit, arjun, kavita, admin] = await Promise.all([
    h.login(EMAILS.priya),
    h.login(EMAILS.rohit),
    h.login(EMAILS.arjun),
    h.login(EMAILS.kavita),
    h.login(EMAILS.admin),
  ]);
  // The database is shared by every test file: start from the default switches (both off).
  await h.db.assistantSettings.deleteMany();
  await h.db.workspaceSettings.deleteMany({ where: { workspaceId: DEFAULT_WORKSPACE_ID } });
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
    const audit = await h.db.auditEvent.count({ where: { action: 'workspace_settings.updated' } });
    expect(audit).toBeGreaterThan(0);
    const av = (await call(h, 'GET', '/assistant/availability', priya)).json<{
      chat: { state: string };
    }>();
    expect(av.chat.state).toBe('AVAILABLE');
  });

  it('never changes a switch without its audit record (save and audit are one transaction)', async () => {
    // F-12: a session for a user that does not exist no longer passes the guard, so the audit
    // insert is made to fail inside the database instead (a real constraint, removed after).
    const byWorkspace = { where: { workspaceId: DEFAULT_WORKSPACE_ID } };
    const before = await h.db.workspaceSettings.findUniqueOrThrow(byWorkspace);
    await h.db.$executeRawUnsafe(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "test_no_settings_audit" CHECK ("action" <> 'workspace_settings.updated') NOT VALID`,
    );
    try {
      const res = await call(h, 'PUT', '/admin/assistant/settings', admin, {
        version: before.version,
        voiceEnabled: !before.voiceEnabled,
      });
      expect(res.statusCode).toBe(500);
    } finally {
      await h.db.$executeRawUnsafe(
        `ALTER TABLE "audit_events" DROP CONSTRAINT "test_no_settings_audit"`,
      );
    }
    const after = await h.db.workspaceSettings.findUniqueOrThrow(byWorkspace);
    expect(after).toMatchObject({ version: before.version, voiceEnabled: before.voiceEnabled });
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
    // What the demo host sends for Priya's first book.
    const book = sampleCustomer('AUTH001').items.find((i) => i.id === 'BK001');
    const pending = book?.facts.find((f) => f.id === 'book.BK001.royalty_pending')?.display ?? '';
    h.setAi((req) =>
      req.task === 'CHAT'
        ? {
            answer: `${book?.title ?? ''} has ${pending} pending.`,
            claims: [{ quote: pending, factIds: ['book.BK001.royalty_pending'] }],
            draft: NO_DRAFT,
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

  it('answers messages sent at the same moment in order, each seeing the one before', async () => {
    const chat = await startChat(priya);
    const prompts: string[] = [];
    h.setAi((req) => {
      if (req.task !== 'CHAT') return defaultHandler(req);
      prompts.push(req.user);
      return { answer: `Answer number ${prompts.length}.`, claims: [], draft: NO_DRAFT };
    });
    const [first, second] = await Promise.all([
      send(priya, chat.id, 'First question about my book'),
      send(priya, chat.id, 'Second question about my book'),
    ]);
    expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
    expect(prompts).toHaveLength(2);
    // Two requests sent at the same moment have no fixed arrival order (either may reach the
    // queue first). What must hold: one turn at a time, and the second sees the first's answer.
    const final = (await call(h, 'GET', `/chat/sessions/${chat.id}`, priya)).json<ChatSession>();
    const [firstAsked, answer1, secondAsked, answer2] = final.messages.map((m) => m.body);
    expect([answer1, answer2]).toEqual(['Answer number 1.', 'Answer number 2.']);
    expect(new Set([firstAsked, secondAsked])).toEqual(
      new Set(['First question about my book', 'Second question about my book']),
    );
    expect(final.messages).toHaveLength(4);
    expect(prompts[0]).toContain(String(firstAsked));
    expect(prompts[1]).toContain(String(firstAsked));
    expect(prompts[1]).toContain('Answer number 1.');
    expect(prompts[1]).toContain(String(secondAsked));
  });

  it('answers common questions instantly from records, without calling the AI', async () => {
    const chat = await startChat(priya);
    let aiCalls = 0;
    h.setAi((req) => {
      if (req.task === 'CHAT') aiCalls += 1;
      return defaultHandler(req);
    });
    const started = performance.now();
    const res = await send(priya, chat.id, 'When is the next payout?');
    const elapsedMs = performance.now() - started;
    const { reply } = res.json<ChatReply>();
    expect(reply.source).toBe('RECORDS');
    expect(reply.body).toContain('next payout cycle closes by');
    expect(reply.factsUsed.map((f) => f.label)).toContain('Next payout cycle closes by');
    expect(elapsedMs).toBeLessThan(500);
    expect(aiCalls).toBe(0);
  });

  it('never shows an invented figure: two failed checks become a safe answer', async () => {
    const chat = await startChat(priya);
    h.setAi((req) =>
      req.task === 'CHAT'
        ? { answer: 'You will get ₹77,777 tomorrow.', claims: [], draft: NO_DRAFT }
        : defaultHandler(req),
    );
    const { reply } = (
      await send(priya, chat.id, 'Tell me about my royalty transfer schedule')
    ).json<ChatReply>();
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
    expect(res.json<ChatReply>().reply.proposal).toBeNull();
    expect(res.json<ChatReply>().session.draft).toBeNull();
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

describe('ticket draft from chat', () => {
  const ISSUE = {
    category: 'ROYALTY_PAYMENTS',
    bookId: null,
    subject: 'Royalty statement looks wrong',
    description: 'My royalty statement for last quarter looks lower than my sales.',
  } as const;
  /** The fake model fills the draft, asks to confirm, or sends, depending on the message. */
  const draftModel = (req: StructuredRequest<unknown>) => {
    if (req.task !== 'CHAT') return defaultHandler(req);
    const latest = req.user.slice(req.user.lastIndexOf('<author_message>'));
    const reply = (answer: string, draft: Record<string, unknown>) => ({
      answer,
      claims: [],
      draft: { ...NO_DRAFT, ...draft },
    });
    if (latest.includes('looks wrong'))
      return reply('I have started a ticket on the right.', { action: 'update', ...ISSUE });
    if (latest.includes('send it'))
      return reply('Royalty & Payments: "Royalty statement looks wrong". Shall I send it?', {
        action: 'confirm',
      });
    if (latest.includes('yes')) return reply('Sending it now.', { action: 'submit' });
    return reply('Happy to help.', {});
  };

  it('fills the draft, asks before sending, and sends exactly one ticket after a yes', async () => {
    h.setAi(draftModel);
    const chat = await startChat(kavita);
    const first = (
      await send(kavita, chat.id, 'My royalty statement looks wrong')
    ).json<ChatReply>();
    expect(first.session.draft).toMatchObject({
      ...ISSUE,
      status: 'OPEN',
      lastEditedBy: 'ASSISTANT',
    });
    const draftId = first.session.draft?.id ?? '';
    await call(h, 'PATCH', `/ticket-drafts/${draftId}`, kavita, {
      subject: 'Royalty statement is low',
    });
    const asked = (await send(kavita, chat.id, 'ok please send it')).json<ChatReply>();
    expect(h.aiCalls.at(-1)?.dynamicSystem).toContain('<author_editable>Royalty statement is low');
    expect(asked.session.draft?.status).toBe('AWAITING_CONFIRMATION');
    expect(await h.db.ticket.count({ where: { chatSessionId: chat.id } })).toBe(0);
    const sent = (await send(kavita, chat.id, 'yes')).json<ChatReply>();
    expect(sent.session.draft?.status).toBe('SUBMITTED');
    const number = sent.session.draft?.ticket?.number ?? 'missing';
    expect(sent.reply.body).toContain(number);
    const tickets = await h.db.ticket.findMany({ where: { chatSessionId: chat.id } });
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      source: 'CHAT',
      subject: 'Royalty statement is low',
      categoryKey: 'ROYALTY_PAYMENTS',
    });
    h.setAi(defaultHandler);
  });

  it('asks for confirmation instead of sending when the author was never asked', async () => {
    h.setAi(draftModel);
    const chat = await startChat(kavita);
    await send(kavita, chat.id, 'My royalty statement looks wrong');
    const res = (await send(kavita, chat.id, 'yes')).json<ChatReply>();
    expect(res.reply.body).toBe(CONFIRM_FIRST_TEXT);
    expect(res.session.draft?.status).toBe('AWAITING_CONFIRMATION');
    expect(await h.db.ticket.count({ where: { chatSessionId: chat.id } })).toBe(0);
    h.setAi(defaultHandler);
  });

  it("keeps the author's edit made while the model was answering", async () => {
    h.setAi(draftModel);
    const chat = await startChat(kavita);
    await send(kavita, chat.id, 'My royalty statement looks wrong');
    const draftId = (
      await h.db.ticketDraft.findUniqueOrThrow({ where: { chatSessionId: chat.id } })
    ).id;
    h.setAi(async (req) => {
      if (req.task !== 'CHAT') return defaultHandler(req);
      await call(h, 'PATCH', `/ticket-drafts/${draftId}`, kavita, { subject: 'My own subject' });
      return {
        answer: 'I updated the subject.',
        claims: [],
        draft: { ...NO_DRAFT, action: 'update', subject: 'Model subject' },
      };
    });
    const res = (await send(kavita, chat.id, 'change the subject')).json<ChatReply>();
    expect(res.reply.body).toBe(AUTHOR_CHANGED_TEXT);
    expect(res.session.draft?.subject).toBe('My own subject');
    h.setAi(defaultHandler);
  });

  it('instant answers from records never touch the draft', async () => {
    h.setAi(draftModel);
    const chat = await startChat(kavita);
    await send(kavita, chat.id, 'My royalty statement looks wrong');
    const res = (await send(kavita, chat.id, 'When is the next payout?')).json<ChatReply>();
    expect(res.reply.source).toBe('RECORDS');
    expect(res.session.draft).toMatchObject({ ...ISSUE, version: 1 });
    h.setAi(defaultHandler);
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

// Last in the file: it uses up Kavita's messages for this minute.
describe('workspace limits', () => {
  it("follows the workspace's own per-minute limit, even above the platform default of 20", async () => {
    const saveLimits = async (messagesPerMinute: number) => {
      const { settings } = (await call(h, 'GET', '/workspace/settings', admin)).json<{
        settings: { version: number };
      }>();
      const res = await call(h, 'PUT', '/workspace/settings', admin, {
        version: settings.version,
        messagesPerMinute,
      });
      expect(res.statusCode).toBe(200);
    };
    await setAssistant({ chatEnabled: true });
    await saveLimits(60);
    const chat = await startChat(kavita);
    const codes: number[] = [];
    for (let i = 0; i < 25; i += 1)
      codes.push((await send(kavita, chat.id, `question ${i}`)).statusCode);
    await saveLimits(20);
    expect(codes.filter((c) => c !== 200)).toEqual([]);
  });
});
