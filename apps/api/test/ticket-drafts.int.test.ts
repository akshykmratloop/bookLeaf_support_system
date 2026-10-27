import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AssistantSettings, TicketDraft } from '@bookleaf/shared';
import type { DraftChange } from '../src/modules/ticket-drafts/live.js';
import { call, createHarness, EMAILS, type Harness } from './helpers/app.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';

let h: Harness;
let priya: string;
let rohit: string;
let admin: string;

const SUBJECT_OK = 'Royalty mismatch'; // ≥ 5
const DESCRIPTION_OK = 'My statement shows less than my sales.'; // ≥ 20

async function enableChat() {
  const { settings } = (await call(h, 'GET', '/admin/assistant', admin)).json<{
    settings: AssistantSettings;
  }>();
  await call(h, 'PUT', '/admin/assistant/settings', admin, {
    version: settings.version,
    chatEnabled: true,
  });
}

/** A conversation made directly in the database, so the per-hour chat limit doesn't apply. */
async function newDraft(): Promise<{ chat: { id: string }; draft: TicketDraft }> {
  const chat = await h.db.chatSession.create({
    data: { workspaceId: DEFAULT_WORKSPACE_ID, authorId: await authorIdOf(EMAILS.priya) },
  });
  const res = await call(h, 'GET', `/ticket-drafts/chat/${chat.id}`, priya);
  expect(res.statusCode).toBe(200);
  return { chat, draft: res.json<TicketDraft>() };
}

const patch = (id: string, body: unknown, cookie = priya) =>
  call(h, 'PATCH', `/ticket-drafts/${id}`, cookie, body);
const submit = (id: string, version: number, cookie = priya) =>
  call(h, 'POST', `/ticket-drafts/${id}/submit`, cookie, { version });

async function bookOf(email: string): Promise<string> {
  const b = await h.db.book.findFirstOrThrow({ where: { author: { user: { email } } } });
  return b.id;
}

const authorIdOf = async (email: string) =>
  (await h.db.author.findFirstOrThrow({ where: { user: { email } } })).id;

beforeAll(async () => {
  h = await createHarness();
  [priya, rohit, admin] = await Promise.all([
    h.login(EMAILS.priya),
    h.login(EMAILS.rohit),
    h.login(EMAILS.admin),
  ]);
  await enableChat();
});
afterAll(() => h.close());

describe('getting the draft of a conversation', () => {
  it('creates an empty draft once and returns the same one after', async () => {
    const { chat, draft } = await newDraft();
    expect(draft).toMatchObject({
      category: null,
      bookId: null,
      subject: '',
      description: '',
      status: 'OPEN',
      version: 0,
      isComplete: false,
      ticket: null,
    });
    const again = await call(h, 'GET', `/ticket-drafts/chat/${chat.id}`, priya);
    expect(again.json<TicketDraft>().id).toBe(draft.id);
  });

  it('requires sign-in (401), an author (403) and my own conversation (404)', async () => {
    const { chat } = await newDraft();
    expect((await call(h, 'GET', `/ticket-drafts/chat/${chat.id}`)).statusCode).toBe(401);
    expect((await call(h, 'GET', `/ticket-drafts/chat/${chat.id}`, admin)).statusCode).toBe(403);
    expect((await call(h, 'GET', `/ticket-drafts/chat/${chat.id}`, rohit)).statusCode).toBe(404);
  });
});

describe('editing the draft', () => {
  it('saves changed fields, bumps the version and strips HTML', async () => {
    const { draft } = await newDraft();
    const book = await bookOf(EMAILS.priya);
    const res = await patch(draft.id, {
      category: 'ROYALTY_PAYMENTS',
      bookId: book,
      subject: '  <b>Royalty</b> mismatch ',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<TicketDraft>()).toMatchObject({
      category: 'ROYALTY_PAYMENTS',
      bookId: book,
      subject: 'Royalty mismatch',
      version: 1,
      lastEditedBy: 'AUTHOR',
    });
  });

  it('accepts text at the maximum lengths and rejects one character more (422)', async () => {
    const { draft } = await newDraft();
    expect((await patch(draft.id, { subject: 's'.repeat(150) })).statusCode).toBe(200);
    expect((await patch(draft.id, { subject: 's'.repeat(151) })).statusCode).toBe(422);
    expect((await patch(draft.id, { description: 'd'.repeat(4000) })).statusCode).toBe(200);
    expect((await patch(draft.id, { description: 'd'.repeat(4001) })).statusCode).toBe(422);
  });

  it('rejects an empty change, an unknown issue type and a book that is not mine (422)', async () => {
    const { draft } = await newDraft();
    expect((await patch(draft.id, {})).statusCode).toBe(422);
    expect((await patch(draft.id, { category: 'NOPE' })).statusCode).toBe(422);
    const notMine = await bookOf(EMAILS.rohit);
    expect((await patch(draft.id, { bookId: notMine })).statusCode).toBe(422);
  });

  it("refuses another author's draft (404), signed-out edits (401) and admins (403)", async () => {
    const { draft } = await newDraft();
    expect((await patch(draft.id, { subject: 'Hello there' }, rohit)).statusCode).toBe(404);
    const signedOut = await call(h, 'PATCH', `/ticket-drafts/${draft.id}`, undefined, {
      subject: 'Hello there',
    });
    expect(signedOut.statusCode).toBe(401);
    const asAdmin = await patch(draft.id, { subject: 'Hello there' }, admin);
    expect(asAdmin.statusCode).toBe(403);
  });

  it('tells a live listener which fields the author changed', async () => {
    const { draft } = await newDraft();
    const seen: DraftChange[] = [];
    const stop = h.container.draftLive.subscribe(draft.id, (c) => seen.push(c));
    await patch(draft.id, { subject: SUBJECT_OK, description: DESCRIPTION_OK });
    stop();
    await patch(draft.id, { subject: 'Not heard any more' });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.by).toBe('AUTHOR');
    expect(seen[0]?.changed).toEqual(['subject', 'description']);
  });
});

describe('sending the draft', () => {
  it('refuses an incomplete draft (422)', async () => {
    const { draft } = await newDraft();
    const res = await patch(draft.id, { subject: 'Shrt', description: DESCRIPTION_OK });
    expect((await submit(draft.id, res.json<TicketDraft>().version)).statusCode).toBe(422);
  });

  it('refuses a version the author has not seen (409 DRAFT_CHANGED)', async () => {
    const { draft } = await newDraft();
    await patch(draft.id, { subject: SUBJECT_OK, description: DESCRIPTION_OK });
    const res = await submit(draft.id, 0);
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('DRAFT_CHANGED');
  });

  it('sends once at the minimum lengths, keeps the issue type through triage, and repeats safely', async () => {
    const { chat, draft } = await newDraft();
    const edited = await patch(draft.id, {
      category: 'PRINTING_QUALITY',
      subject: 'Pages',
      description: 'd'.repeat(20),
    });
    const version = edited.json<TicketDraft>().version;
    const first = await submit(draft.id, version);
    expect(first.statusCode).toBe(201);
    const body = first.json<{ draft: TicketDraft; ticket: { id: string } }>();
    expect(body.draft.status).toBe('SUBMITTED');
    expect(body.draft.ticket?.id).toBe(body.ticket.id);
    const again = await submit(draft.id, version);
    expect(again.statusCode).toBe(200);
    expect(again.json<{ ticket: { id: string } }>().ticket.id).toBe(body.ticket.id);
    await h.drain();
    const t = await h.db.ticket.findUniqueOrThrow({ where: { id: body.ticket.id } });
    expect(t).toMatchObject({
      category: 'PRINTING_QUALITY',
      categorySource: 'AUTHOR',
      source: 'CHAT',
      chatSessionId: chat.id,
    });
    const edit = await patch(draft.id, { subject: 'Changed after sending' });
    expect(edit.statusCode).toBe(409);
    expect(edit.json<{ code: string }>().code).toBe('DRAFT_SENT');
  });

  it('creates exactly one ticket when Send is pressed twice at once', async () => {
    const { chat, draft } = await newDraft();
    const edited = await patch(draft.id, { subject: SUBJECT_OK, description: DESCRIPTION_OK });
    const version = edited.json<TicketDraft>().version;
    const results = await Promise.all([submit(draft.id, version), submit(draft.id, version)]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 201]);
    expect(await h.db.ticket.count({ where: { chatSessionId: chat.id } })).toBe(1);
  });
});

describe('assistant confirmation rules', () => {
  it('the assistant can only send after asking, and any edit cancels the request', async () => {
    const svc = h.container.ticketDrafts;
    const authorId = await authorIdOf(EMAILS.priya);
    const session = {
      userId: 'test',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'AUTHOR' as const,
      authorId,
      name: 'Priya',
      email: EMAILS.priya,
    };
    const { draft } = await newDraft();
    await expect(svc.requestConfirmation(authorId, draft.id)).rejects.toMatchObject({
      status: 422,
    });
    await svc.edit(
      authorId,
      draft.id,
      { subject: SUBJECT_OK, description: DESCRIPTION_OK },
      'ASSISTANT',
    );
    const early = svc.submit(session, draft.id, { by: 'ASSISTANT', version: null });
    await expect(early).rejects.toMatchObject({ code: 'DRAFT_NOT_CONFIRMED' });
    const asked = await svc.requestConfirmation(authorId, draft.id);
    expect(asked.status).toBe('AWAITING_CONFIRMATION');
    const changed = await svc.edit(authorId, draft.id, { subject: 'A newer subject' }, 'AUTHOR');
    expect(changed.status).toBe('OPEN');
    await svc.requestConfirmation(authorId, draft.id);
    const sent = await svc.submit(session, draft.id, { by: 'ASSISTANT', version: null });
    expect(sent.created).toBe(true);
    expect(sent.draft.status).toBe('SUBMITTED');
  });
});
