import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TicketDraft } from '@bookleaf/shared';
import type { DraftChange } from '../src/modules/ticket-drafts/live.js';
import { call, createHarness, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let priya: string;
let rohit: string;
let admin: string;

const FILLED = {
  category: 'ROYALTY_PAYMENTS',
  subject: 'Royalty mismatch',
  description: 'My statement shows less than my sales.',
};

/** A conversation made directly in the database, with a filled-in draft. */
async function filledDraft(): Promise<TicketDraft> {
  const author = await h.db.author.findFirstOrThrow({ where: { user: { email: EMAILS.priya } } });
  const chat = await h.db.chatSession.create({ data: { authorId: author.id } });
  const draft = (await call(h, 'GET', `/ticket-drafts/chat/${chat.id}`, priya)).json<TicketDraft>();
  const res = await call(h, 'PATCH', `/ticket-drafts/${draft.id}`, priya, FILLED);
  expect(res.statusCode).toBe(200);
  return res.json<TicketDraft>();
}

const discard = (id: string, version: number, cookie = priya) =>
  call(h, 'POST', `/ticket-drafts/${id}/discard`, cookie, { version });

beforeAll(async () => {
  h = await createHarness();
  [priya, rohit, admin] = await Promise.all([
    h.login(EMAILS.priya),
    h.login(EMAILS.rohit),
    h.login(EMAILS.admin),
  ]);
});
afterAll(() => h.close());

describe('discarding the ticket draft', () => {
  it('empties every field, keeps the same draft and tells a live call', async () => {
    const draft = await filledDraft();
    const seen: DraftChange[] = [];
    const stop = h.container.draftLive.subscribe(draft.id, (c) => seen.push(c));
    const res = await discard(draft.id, draft.version);
    stop();
    expect(res.statusCode).toBe(200);
    expect(res.json<TicketDraft>()).toMatchObject({
      id: draft.id,
      category: null,
      bookId: null,
      subject: '',
      description: '',
      status: 'OPEN',
      version: draft.version + 1,
      lastEditedBy: 'AUTHOR',
      isComplete: false,
      ticket: null,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ by: 'AUTHOR', discarded: true });
  });

  it('refuses a version the author has not seen (409 DRAFT_CHANGED)', async () => {
    const draft = await filledDraft();
    const res = await discard(draft.id, draft.version - 1);
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('DRAFT_CHANGED');
  });

  it('refuses a draft that was already sent (409 DRAFT_SENT)', async () => {
    const draft = await filledDraft();
    const sent = await call(h, 'POST', `/ticket-drafts/${draft.id}/submit`, priya, {
      version: draft.version,
    });
    expect(sent.statusCode).toBe(201);
    const res = await discard(draft.id, draft.version);
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('DRAFT_SENT');
  });

  it('requires sign-in (401), an author (403) and my own draft (404)', async () => {
    const draft = await filledDraft();
    const signedOut = await call(h, 'POST', `/ticket-drafts/${draft.id}/discard`, undefined, {
      version: draft.version,
    });
    expect(signedOut.statusCode).toBe(401);
    expect((await discard(draft.id, draft.version, admin)).statusCode).toBe(403);
    expect((await discard(draft.id, draft.version, rohit)).statusCode).toBe(404);
    const still = await h.db.ticketDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(still.subject).toBe(FILLED.subject);
  });

  it('rejects a missing or negative version (422)', async () => {
    const draft = await filledDraft();
    const none = await call(h, 'POST', `/ticket-drafts/${draft.id}/discard`, priya, {});
    expect(none.statusCode).toBe(422);
    expect((await discard(draft.id, -1)).statusCode).toBe(422);
  });
});
