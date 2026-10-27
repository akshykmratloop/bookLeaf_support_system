import type { TicketDraft } from '@bookleaf/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DraftEditor, type DraftApi } from './draftEditor';

const base: TicketDraft = {
  id: '00000000-0000-4000-8000-000000000001',
  category: null,
  bookId: null,
  subject: '',
  description: '',
  status: 'OPEN',
  version: 0,
  lastEditedBy: 'ASSISTANT',
  isComplete: false,
  ticket: null,
  updatedAt: '2026-10-27T10:00:00.000Z',
};

let server: TicketDraft;
let edits: Record<string, unknown>[];
let saved: TicketDraft[];

const api: DraftApi = {
  edit: vi.fn(async (_id, patch) => {
    edits.push(patch);
    server = {
      ...server,
      ...patch,
      version: server.version + 1,
      lastEditedBy: 'AUTHOR',
    } as TicketDraft;
    return server;
  }),
  submit: vi.fn(async () => {
    server = { ...server, status: 'SUBMITTED', ticket: { id: 't', number: 'BL-1001' } };
    return { draft: server };
  }),
  discard: vi.fn(async () => {
    server = {
      ...server,
      category: null,
      bookId: null,
      subject: '',
      description: '',
      version: server.version + 1,
      lastEditedBy: 'AUTHOR',
    };
    return server;
  }),
};

function editor() {
  const e = new DraftEditor(api, (err) => String(err), 600);
  e.setOnSaved((d) => saved.push(d));
  e.receive(server);
  return e;
}

beforeEach(() => {
  vi.useFakeTimers();
  server = { ...base };
  edits = [];
  saved = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('DraftEditor', () => {
  it('saves typing once after a pause, and an issue type at once', async () => {
    const e = editor();
    e.change('subject', 'Pa');
    e.change('subject', 'Pages are blurry');
    await vi.advanceTimersByTimeAsync(599);
    expect(edits).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(edits).toEqual([{ subject: 'Pages are blurry' }]);
    e.change('category', 'PRINTING_QUALITY');
    await vi.advanceTimersByTimeAsync(0);
    expect(edits.at(-1)).toEqual({ category: 'PRINTING_QUALITY' });
    expect(saved.at(-1)?.version).toBe(2);
  });

  it("never overwrites a field the author is typing in, but takes the assistant's other changes", () => {
    const e = editor();
    e.change('subject', 'My words');
    e.receive({
      ...server,
      version: 1,
      subject: 'Assistant subject',
      description: 'Assistant text here.',
    });
    expect(e.snapshot().values.subject).toBe('My words');
    expect(e.snapshot().values.description).toBe('Assistant text here.');
    expect(e.snapshot().highlighted).toEqual(['description']);
    vi.advanceTimersByTime(2500);
    expect(e.snapshot().highlighted).toEqual([]);
  });

  it('ignores an older version arriving late', () => {
    const e = editor();
    e.receive({ ...server, version: 3, subject: 'Newest' });
    e.receive({ ...server, version: 2, subject: 'Older' });
    expect(e.snapshot().values.subject).toBe('Newest');
  });

  it('saves pending typing before sending, then sends the saved version', async () => {
    const e = editor();
    e.change('subject', 'Pages are blurry');
    await e.send();
    expect(edits).toEqual([{ subject: 'Pages are blurry' }]);
    expect(api.submit).toHaveBeenCalledWith(base.id, 1);
    expect(e.snapshot().draft?.status).toBe('SUBMITTED');
  });

  it('clears a chosen book back to account level as null', async () => {
    server = { ...server, bookId: '00000000-0000-4000-8000-0000000000b1' };
    const e = editor();
    e.change('bookId', '');
    await vi.advanceTimersByTimeAsync(0);
    expect(edits).toEqual([{ bookId: null }]);
  });

  it('shows the server message when sending fails', async () => {
    vi.mocked(api.submit).mockRejectedValueOnce('The draft just changed.');
    const e = editor();
    await e.send();
    expect(e.snapshot()).toMatchObject({ error: 'The draft just changed.', sending: false });
  });

  it('discards: drops unsaved typing, empties the form and never saves the old text', async () => {
    server = { ...server, subject: 'Old subject', version: 4 };
    const e = editor();
    e.change('subject', 'Still typing');
    await e.discard();
    await vi.advanceTimersByTimeAsync(1000);
    expect(edits).toEqual([]);
    expect(api.discard).toHaveBeenCalledWith(base.id, 4);
    expect(e.snapshot().values).toEqual({ category: '', bookId: '', subject: '', description: '' });
    expect(e.snapshot().discarding).toBe(false);
    expect(saved.at(-1)?.version).toBe(5);
  });

  it('shows the server message when discarding fails', async () => {
    vi.mocked(api.discard).mockRejectedValueOnce('This ticket has already been sent.');
    const e = editor();
    await e.discard();
    expect(e.snapshot()).toMatchObject({
      error: 'This ticket has already been sent.',
      discarding: false,
    });
  });
});
